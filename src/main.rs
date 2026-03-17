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
        Self {
            api_url: std::env::var("SOLMAIL_API_URL")
                .unwrap_or_else(|_| "https://solmail.online/api".to_string()),
            network,
            rpc_url,
            private_key: std::env::var("SOLANA_PRIVATE_KEY").ok(),
            merchant_wallet: std::env::var("MERCHANT_WALLET")
                .unwrap_or_else(|_| "B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp".to_string()),
            client: reqwest::Client::new(),
        }
    }

    fn has_wallet(&self) -> bool {
        self.private_key.is_some()
    }

    fn wallet_address(&self) -> Result<String, String> {
        let pk = self
            .private_key
            .as_ref()
            .ok_or("Wallet not configured. Set SOLANA_PRIVATE_KEY.")?;
        let decoded = bs58::decode(pk)
            .into_vec()
            .map_err(|e| format!("Invalid key: {e}"))?;
        if decoded.len() < 64 {
            return Err("Key must be 64 bytes".to_string());
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
        {
            return v["solana"]["usd"].as_f64().unwrap_or(100.0);
        }
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
            .map_err(|e| format!("{e}"))?;
        let val: Value = resp.json().await.map_err(|e| format!("{e}"))?;
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
            let content = args["content"].as_str().ok_or("content required")?;
            let recipient = &args["recipient"];
            let country = recipient["country"].as_str().unwrap_or("US");
            let color = args["mailOptions"]["color"].as_bool().unwrap_or(false);
            let total = mail_price(country) + if color { 0.50 } else { 0.0 };
            let sol_price = cfg.sol_price().await;
            let sol_amount = total / sol_price;

            let resp = cfg.client.post(format!("{}/send-letter", cfg.api_url))
                .json(&json!({
                    "address": recipient, "content": content, "contentType": "text",
                    "priceUsd": total,
                    "mailConfig": {"color": color, "doubleSided": args["mailOptions"]["doubleSided"].as_bool().unwrap_or(false), "mailClass": args["mailOptions"]["mailClass"].as_str().unwrap_or("first_class")}
                }))
                .send().await.map_err(|e| format!("API error: {e}"))?;
            let result: Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
            Ok(
                json!({"success": true, "result": result, "payment": {"amount": sol_amount, "priceUsd": total}}),
            )
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
        if stdin.lock().read_line(&mut line).unwrap_or(0) == 0 {
            break;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let req: JsonRpcRequest = match serde_json::from_str(trimmed) {
            Ok(r) => r,
            Err(_) => continue,
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
                        json!({"jsonrpc":"2.0","id":req.id,"result":{"content":[{"type":"text","text":serde_json::to_string_pretty(&r).unwrap_or_default()}]}})
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
        let out = serde_json::to_string(&response).unwrap();
        let mut lock = stdout.lock();
        let _ = writeln!(lock, "{out}");
        let _ = lock.flush();
    }
}
