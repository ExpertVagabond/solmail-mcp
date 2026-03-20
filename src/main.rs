use serde::Deserialize;
use serde_json::{Value, json};
use std::io::BufRead;
use tracing::info;

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

struct Config {
    api_url: String,
    network: String,
    rpc_url: String,
    private_key: Option<String>,
    merchant_wallet: String,
    client: reqwest::Client,
}

impl Config {
    fn new() -> Self {
        let network = std::env::var("SOLANA_NETWORK").unwrap_or_else(|_| "devnet".to_string());
        let rpc_url = std::env::var("SOLANA_RPC_URL")
            .unwrap_or_else(|_| format!("https://api.{network}.solana.com"));

        // SECURITY: MERCHANT_WALLET must be set via env var. No hardcoded fallback.
        let merchant_wallet = std::env::var("MERCHANT_WALLET").unwrap_or_else(|_| {
            eprintln!("WARNING: MERCHANT_WALLET not set. Payment tools will fail.");
            String::new()
        });

        // SECURITY: Private key is read from env only. Never log or expose this value.
        let private_key = std::env::var("SOLANA_PRIVATE_KEY").ok();
        if let Some(ref pk) = private_key {
            // Validate key format: must be valid base58 and decode to 64 bytes
            match bs58::decode(pk).into_vec() {
                Ok(bytes) if bytes.len() == 64 => {
                    info!("Wallet private key loaded (format valid)");
                }
                Ok(bytes) => {
                    eprintln!("WARNING: SOLANA_PRIVATE_KEY decoded to {} bytes, expected 64", bytes.len());
                }
                Err(e) => {
                    eprintln!("WARNING: SOLANA_PRIVATE_KEY is not valid base58: {e}");
                }
            }
        }

        Self {
            api_url: std::env::var("SOLMAIL_API_URL")
                .unwrap_or_else(|_| "https://solmail.online/api".to_string()),
            network,
            rpc_url,
            private_key,
            merchant_wallet,
            client: reqwest::Client::new(),
        }
    }

    fn has_wallet(&self) -> bool {
        self.private_key.is_some()
    }

    fn wallet_address(&self) -> Result<String, String> {
        // SECURITY: Only derive the public key from the private key. Never log the private key.
        let pk = self
            .private_key
            .as_ref()
            .ok_or("Wallet not configured. Set SOLANA_PRIVATE_KEY.")?;
        let decoded = bs58::decode(pk)
            .into_vec()
            .map_err(|e| format!("Invalid private key format: {e}"))?;
        if decoded.len() != 64 {
            return Err(format!(
                "Private key must decode to exactly 64 bytes, got {}",
                decoded.len()
            ));
        }
        Ok(bs58::encode(&decoded[32..]).into_string())
    }

    async fn sol_price(&self) -> f64 {
        let resp = self
            .client
            .get("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")
            .send()
            .await
            .ok();
        if let Some(r) = resp
            && let Ok(v) = r.json::<Value>().await
            && let Some(price) = v["solana"]["usd"].as_f64()
        {
            return price;
        }
        // SECURITY: Fallback price used — log warning so operators are aware.
        // This could lead to incorrect payment amounts if CoinGecko is unreachable.
        eprintln!("WARNING: CoinGecko price fetch failed, using fallback SOL price of $100.00. Payments may be inaccurate.");
        100.0
    }

    async fn get_balance(&self) -> Result<Value, String> {
        let addr = self.wallet_address()?;
        let body = json!({"jsonrpc":"2.0","id":1,"method":"getBalance","params":[addr]});
        let resp = self
            .client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("RPC request failed: {e}"))?;
        let val: Value = resp.json().await.map_err(|e| format!("RPC response parse error: {e}"))?;
        let lamports = val["result"]["value"].as_u64().unwrap_or(0);
        let sol = lamports as f64 / LAMPORTS_PER_SOL as f64;
        Ok(
            json!({"address": addr, "balance": sol, "balanceLamports": lamports, "network": self.network}),
        )
    }
}

fn mail_price(country: &str) -> f64 {
    if country.to_uppercase() == "US" {
        1.50
    } else {
        2.50
    }
}

#[derive(Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

fn tool_definitions() -> Value {
    json!([
        {"name":"get_mail_quote","description":"Get a price quote for sending physical mail via Solana","inputSchema":{"type":"object","properties":{"country":{"type":"string","description":"Destination country code"},"color":{"type":"boolean","default":false}}}},
        {"name":"send_mail","description":"Send physical mail using Solana cryptocurrency payment","inputSchema":{"type":"object","properties":{"content":{"type":"string","description":"Letter content"},"recipient":{"type":"object","properties":{"name":{"type":"string"},"addressLine1":{"type":"string"},"city":{"type":"string"},"state":{"type":"string"},"zipCode":{"type":"string"},"country":{"type":"string","default":"US"}},"required":["name","addressLine1","city","state","zipCode"]},"mailOptions":{"type":"object","properties":{"color":{"type":"boolean"},"doubleSided":{"type":"boolean"},"mailClass":{"type":"string","enum":["standard","first_class","priority"]}}}},"required":["content","recipient"]}},
        {"name":"get_wallet_balance","description":"Get SOL balance of configured wallet","inputSchema":{"type":"object","properties":{}}},
        {"name":"get_wallet_address","description":"Get public address of configured wallet","inputSchema":{"type":"object","properties":{}}}
    ])
}

async fn call_tool(cfg: &Config, name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "get_mail_quote" => {
            let country = args["country"].as_str().unwrap_or("US");
            let color = args["color"].as_bool().unwrap_or(false);
            let base = mail_price(country);
            let total = base + if color { 0.50 } else { 0.0 };
            let sol_price = cfg.sol_price().await;
            let sol_amount = total / sol_price;
            Ok(json!({
                "priceUsd": total, "priceSol": sol_amount, "solPrice": sol_price,
                "breakdown": {"basePrice": base, "colorPrinting": if color { 0.50 } else { 0.0 }},
                "country": country,
                "estimatedDelivery": if country.to_uppercase() == "US" { "3-5 business days" } else { "7-14 business days" }
            }))
        }
        "send_mail" => {
            if !cfg.has_wallet() {
                return Err("Wallet not configured. Set SOLANA_PRIVATE_KEY.".to_string());
            }
            if cfg.merchant_wallet.is_empty() {
                return Err("MERCHANT_WALLET not configured. Cannot process payments.".to_string());
            }
            let content = args["content"].as_str().ok_or("content is required")?;
            let recipient = &args["recipient"];
            if recipient.is_null() {
                return Err("recipient is required".to_string());
            }
            let country = recipient["country"].as_str().unwrap_or("US");
            let color = args["mailOptions"]["color"].as_bool().unwrap_or(false);
            let double_sided = args["mailOptions"]["doubleSided"].as_bool().unwrap_or(false);
            let mail_class = args["mailOptions"]["mailClass"].as_str().unwrap_or("first_class");
            let total = mail_price(country) + if color { 0.50 } else { 0.0 };
            let sol_price = cfg.sol_price().await;
            let sol_amount = total / sol_price;

            // Get wallet address for the payment (validates key format)
            let wallet_addr = cfg.wallet_address()?;

            // Get balance to verify sufficient funds
            let balance_body = json!({"jsonrpc":"2.0","id":1,"method":"getBalance","params":[wallet_addr]});
            let balance_resp = cfg.client.post(&cfg.rpc_url)
                .json(&balance_body)
                .send().await.map_err(|e| format!("Balance check failed: {e}"))?;
            let balance_val: Value = balance_resp.json().await.map_err(|e| format!("Balance parse error: {e}"))?;
            let balance_lamports = balance_val["result"]["value"].as_u64().unwrap_or(0);
            let needed_lamports = (sol_amount * LAMPORTS_PER_SOL as f64).ceil() as u64 + 10_000;
            if balance_lamports < needed_lamports {
                return Err(format!(
                    "Insufficient SOL balance: have {} lamports, need {} (including fees)",
                    balance_lamports, needed_lamports
                ));
            }

            // Submit to SolMail print/mail API
            let resp = cfg.client.post(format!("{}/send-letter", cfg.api_url))
                .json(&json!({
                    "address": recipient,
                    "content": content,
                    "contentType": "text",
                    "priceUsd": total,
                    "walletAddress": wallet_addr,
                    "merchantWallet": cfg.merchant_wallet,
                    "mailConfig": {
                        "color": color,
                        "doubleSided": double_sided,
                        "mailClass": mail_class,
                    }
                }))
                .send().await.map_err(|e| format!("SolMail API error: {e}"))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("SolMail API returned {status}: {body}"));
            }

            let result: Value = resp.json().await.map_err(|e| format!("Response parse error: {e}"))?;
            Ok(json!({
                "success": true,
                "result": result,
                "payment": {
                    "amount": sol_amount,
                    "priceUsd": total,
                    "solPrice": sol_price,
                    "merchantWallet": cfg.merchant_wallet,
                },
                "recipient": recipient["name"].as_str().unwrap_or("unknown"),
                "country": country,
            }))
        }
        "get_wallet_balance" => cfg.get_balance().await,
        "get_wallet_address" => {
            let addr = cfg.wallet_address()?;
            Ok(json!({"address": addr, "network": cfg.network}))
        }
        _ => Err(format!("Unknown tool: {name}")),
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_writer(std::io::stderr)
        .init();
    info!("solmail-mcp starting on stdio");
    let cfg = Config::new();
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut line = String::new();
    loop {
        line.clear();
        match stdin.lock().read_line(&mut line) {
            Ok(0) => break, // EOF
            Ok(_) => {}
            Err(e) => {
                eprintln!("stdin read error: {e}");
                break;
            }
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let req: JsonRpcRequest = match serde_json::from_str(trimmed) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("JSON parse error: {e}");
                continue;
            }
        };
        let response = match req.method.as_str() {
            "initialize" => {
                json!({"jsonrpc":"2.0","id":req.id,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"solmail-mcp","version":"0.1.0"}}})
            }
            "notifications/initialized" => continue,
            "tools/list" => {
                json!({"jsonrpc":"2.0","id":req.id,"result":{"tools":tool_definitions()}})
            }
            "tools/call" => {
                let tn = req.params["name"].as_str().unwrap_or("");
                let a = &req.params["arguments"];
                match call_tool(&cfg, tn, a).await {
                    Ok(r) => {
                        let text = serde_json::to_string_pretty(&r)
                            .unwrap_or_else(|e| format!("Serialization error: {e}"));
                        json!({"jsonrpc":"2.0","id":req.id,"result":{"content":[{"type":"text","text":text}]}})
                    }
                    Err(e) => {
                        json!({"jsonrpc":"2.0","id":req.id,"result":{"content":[{"type":"text","text":format!("Error: {e}")}],"isError":true}})
                    }
                }
            }
            _ => {
                json!({"jsonrpc":"2.0","id":req.id,"error":{"code":-32601,"message":format!("Unknown method: {}",req.method)}})
            }
        };
        use std::io::Write;
        let out = match serde_json::to_string(&response) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Response serialization error: {e}");
                continue;
            }
        };
        let mut lock = stdout.lock();
        let _ = writeln!(lock, "{out}");
        let _ = lock.flush();
    }
}
