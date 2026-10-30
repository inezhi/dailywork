#!/usr/bin/env bash
# Generate a local certificate for the Dailywork LAN server.
# Uses mkcert when available; otherwise creates a self-signed CA/server cert.
set -euo pipefail

DATA_DIR="${DAILYWORK_DATA_DIR:-$HOME/Library/Application Support/Dailywork}"
CERT_DIR="$DATA_DIR/certs"
mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$IP" ]; then
  IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [ -z "$IP" ]; then
  echo "未检测到局域网 IPv4 地址，请先连接 Wi-Fi。"
  exit 1
fi

if command -v mkcert >/dev/null 2>&1; then
  echo "使用 mkcert 生成证书（这会信任当前设备的 CA）…"
  mkcert -install
  mkcert -cert-file "$CERT_DIR/server.crt" -key-file "$CERT_DIR/server.key" \
    localhost 127.0.0.1 "$IP"
  cp "$(mkcert -CAROOT)/rootCA.pem" "$CERT_DIR/dailywork-ca.crt"
  echo "已生成证书。mkcert 的根证书在：$(mkcert -CAROOT)/rootCA.pem"
  echo "iPhone/iPad：AirDrop 该 rootCA.pem，安装描述文件并在「证书信任设置」中开启完全信任。"
else
  echo "未安装 mkcert，使用 OpenSSL 生成自签名证书…"
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/CN=Dailywork Local" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$IP" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,digitalSignature,keyEncipherment"
  cp "$CERT_DIR/server.crt" "$CERT_DIR/dailywork-ca.crt"
  echo "已生成自签名证书（含 $IP）。"
  echo "iPhone/iPad：AirDrop $CERT_DIR/dailywork-ca.crt，"
  echo "安装描述文件后，到系统设置的「证书信任设置」开启完全信任。"
fi

chmod 600 "$CERT_DIR/server.key" "$CERT_DIR/server.crt" "$CERT_DIR/dailywork-ca.crt"
echo
echo "证书目录：$CERT_DIR"
echo "请退出并重新打开 Dailywork。设置 → 通用 → 局域网访问 会显示 HTTPS 地址。"
