const userAgents = [
    // Windows - Desktop
    { name: "Windows 11 - Chrome", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    { name: "Windows 10 - Firefox", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0" },
    { name: "Windows 11 - Edge", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0" },
    { name: "Windows 10 - Opera", ua: "Mozilla/5.0 (Windows NT 10.0; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/109.0.0.0" },

    // Android - Mobiteli
    { name: "Samsung Galaxy S23", ua: "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36" },
    { name: "Google Pixel 8 Pro", ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.113 Mobile Safari/537.36" },
    { name: "Samsung Galaxy A54", ua: "Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36" },
    { name: "Xiaomi 13 Ultra", ua: "Mozilla/5.0 (Linux; Android 13; Xiaomi 13 Ultra) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36" },
    { name: "Redmi Note 12", ua: "Mozilla/5.0 (Linux; Android 12; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36" },
    { name: "Huawei P50 Pro", ua: "Mozilla/5.0 (Linux; Android 11; P50 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36" },

    // iOS - iPhone & iPad
    { name: "iPhone 15 Pro Max", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1" },
    { name: "iPhone 14 Plus", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" },
    { name: "iPad Pro 12.9", ua: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1" },
    { name: "iPhone 13 Mini", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1" },

    // Apple Mac
    { name: "MacBook Air M2", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    { name: "iMac 24 - Safari", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15" },
    { name: "Mac mini - Firefox", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0" },

    // Linux & Ostalo
    { name: "Ubuntu Linux - Chrome", ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    { name: "Debian - Firefox", ua: "Mozilla/5.0 (X11; Debian; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0" },
    { name: "Samsung Galaxy Tab S9", ua: "Mozilla/5.0 (Linux; Android 13; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Safari/537.36" },

    // Dodatni za broj do 30
    { name: "OnePlus 11", ua: "Mozilla/5.0 (Linux; Android 13; CPH2447) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36" },
    { name: "Sony Xperia 1 V", ua: "Mozilla/5.0 (Linux; Android 13; XQ-DQ72) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36" },
    { name: "Asus ROG Phone 7", ua: "Mozilla/5.0 (Linux; Android 13; AI2205) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36" },
    { name: "Motorola Edge 40", ua: "Mozilla/5.0 (Linux; Android 13; XT2303-2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36" },
    { name: "Nokia G42", ua: "Mozilla/5.0 (Linux; Android 13; Nokia G42 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36" },
    { name: "Windows 10 - Brave", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Brave/1.65.114" },
    { name: "macOS - Vivaldi", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Vivaldi/6.7.3329.21" },
    { name: "iPhone 12 Pro", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.3 Mobile/15E148 Safari/604.1" },
    { name: "Samsung Galaxy A52", ua: "Mozilla/5.0 (Linux; Android 11; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36" },
    { name: "Lenovo Tab P11", ua: "Mozilla/5.0 (Linux; Android 12; TB-J606F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" }
];

module.exports = {
    getRandom: () => userAgents[Math.floor(Math.random() * userAgents.length)]
};
