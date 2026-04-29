use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// HTTP 请求参数
#[derive(Debug, Deserialize)]
pub struct HttpRequest {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

/// HTTP 响应
#[derive(Debug, Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
    pub ok: bool,
}

/// 通用 HTTP 代理命令
/// 绕过浏览器 CORS 限制
#[tauri::command]
pub async fn http_proxy(request: HttpRequest) -> Result<HttpResponse, String> {
    let client = reqwest::Client::new();
    
    let method = match request.method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        _ => return Err(format!("Unsupported HTTP method: {}", request.method)),
    };

    let mut req_builder = client.request(method, &request.url);

    // 添加请求头
    for (key, value) in request.headers {
        req_builder = req_builder.header(&key, &value);
    }

    // 添加请求体
    if let Some(body) = request.body {
        req_builder = req_builder.body(body);
    }

    // 发送请求
    let response = req_builder
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = response.status().as_u16();
    let ok = response.status().is_success();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(HttpResponse { status, body, ok })
}
