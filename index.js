import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { bech32 } from "bech32";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import fs from "fs";

// Hàm log tiếng Việt
function log(message, type = 'info', indent = 0) {
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour12: false }); // 14:30:25
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'wait') icon = '⏳';
    else if (type === 'wallet') icon = '💼';
    else if (type === 'proxy') icon = '🌐';

    const prefix = '   '.repeat(indent);
    console.log(`[${timestamp}] ${icon} ${prefix}${message}`);
}

async function connectToCreek(walletAddress, proxy, inviteCode, apiUrl) {
    try {
        const proxyAgent = new HttpsProxyAgent(proxy);
        const response = await axios.post(
            apiUrl,
            { walletAddress, inviteCode },
            {
                headers: {
                    authority: "api-test.creek.finance",
                    accept: "*/*",
                    "accept-language": "vi-VN,vi;q=0.9",
                    "content-type": "application/json",
                    origin: "https://beta.creek.finance",
                    referer: "https://beta.creek.finance/",
                    "sec-ch-ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-site",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
                    "x-request-id": Math.random().toString(36).substring(2, 12),
                },
                httpsAgent: proxyAgent,
                timeout: 15000,
            }
        );

        if (response.data && response.data.success) {
            const userData = response.data.data.user;
            const shortAddress = `${walletAddress.slice(0, 5)}...${walletAddress.slice(-5)}`;

            log(`Đăng ký thành công!`, 'success', 1);
            log(`Mã mời: ${userData.invite_code}`, 'info', 2);
            log(`Địa chỉ: ${shortAddress}`, 'info', 2);

            const logMessage = `Thành công ---- ${userData.invite_code} ---- ${userData.wallet_address}\n`;
            fs.appendFileSync('log.txt', logMessage, 'utf-8');
            return true;
        }

        log(`Lỗi API: ${response.data.msg || 'Không rõ'}`, 'error', 1);
        return false;

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            log(`Proxy timeout, chuyển proxy khác...`, 'error', 1);
        } else {
            const status = error.response?.status || 'N/A';
            log(`Kết nối thất bại (mã: ${status}), thử proxy tiếp...`, 'error', 1);
        }
        return false;
    }
}

// Delay
const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

async function main() {
    // Đọc dữ liệu
    const privateKeys = fs.readFileSync("Key.txt", "utf8").trim().split(/\r?\n/).filter(Boolean);
    const proxies = fs.readFileSync("Proxy.txt", "utf8").trim().split(/\r?\n/).filter(Boolean);
    const inviteCodes = fs.readFileSync('InviteCode.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean);
    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

    if (privateKeys.length === 0) {
        log(`Không tìm thấy private key trong Key.txt!`, 'error');
        return;
    }
    if (proxies.length === 0) {
        log(`Không tìm thấy proxy trong Proxy.txt!`, 'error');
        return;
    }
    if (inviteCodes.length === 0) {
        log(`Không tìm thấy mã mời trong InviteCode.txt!`, 'error');
        return;
    }

    let walletCounter = 0;

    for (const privateKey of privateKeys) {
        walletCounter++;
        log(`Đang xử lý ví ${walletCounter}/${privateKeys.length}...`, 'wallet');

        const randomInviteCode = inviteCodes[Math.floor(Math.random() * inviteCodes.length)];
        log(`Dùng mã mời: ${randomInviteCode}`, 'info', 1);

        let success = false;

        for (const proxy of proxies) {
            try {
                // Giải mã private key
                const decoded = bech32.decode(privateKey);
                const privateKeyBytes = new Uint8Array(bech32.fromWords(decoded.words));
                const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes.slice(1));
                const suiAddress = keypair.getPublicKey().toSuiAddress();

                // Ẩn thông tin proxy
                const atIndex = proxy.lastIndexOf('@');
                const shortProxy = atIndex !== -1 ? `http://...${proxy.substring(atIndex)}` : proxy;
                log(`Dùng proxy: ${shortProxy}`, 'proxy', 1);

                // Gửi request
                const result = await connectToCreek(suiAddress, proxy, randomInviteCode, config.creek_api_url);
                if (result) {
                    success = true;
                    break;
                }

                await sleep(1); // Nghỉ 1s giữa các proxy
            } catch (error) {
                log(`Lỗi xử lý ví: ${error.message}`, 'error', 1);
            }
        }

        if (!success) {
            log(`Không thể đăng ký ví này bằng proxy nào.`, 'error', 1);
        }

        // Nghỉ giữa các ví
        if (walletCounter < privateKeys.length) {
            log(`Chờ ${config.wallet_interval_seconds}s trước ví tiếp theo...`, 'wait');
            await sleep(config.wallet_interval_seconds);
        }
    }

    log('HOÀN TẤT! Tất cả ví đã được xử lý.', 'success');
}

main().catch(err => log(`Lỗi hệ thống: ${err.message}`, 'error'));
