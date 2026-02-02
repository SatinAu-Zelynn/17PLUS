// 注入拦截脚本 (Hook)
// 保持尽早注入，以确保能拦截到最早的 XHR 初始化
const script = document.createElement('script');
script.src = chrome.runtime.getURL('hook.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// === 配置同步逻辑 ===
// hook.js 运行在页面上下文，无法直接访问 chrome.storage
// content.js 负责从 chrome.storage 读取配置并写入 window.localStorage 供 hook.js 使用

function updateLocalStorage(key, value) {
    if (value === undefined || value === null) {
        localStorage.removeItem(key);
    } else {
        localStorage.setItem(key, value);
    }
}

function syncSettings() {
    chrome.storage.local.get(['customList', 'enableCustom'], (items) => {
        // 同步名单
        if (items.customList) {
            updateLocalStorage('17PLUS_CUSTOM_LIST', JSON.stringify(items.customList));
        }
        
        // 同步开关 (hook.js 期望的是字符串 'true')
        const enableStr = items.enableCustom ? 'true' : 'false';
        updateLocalStorage('17PLUS_ENABLE_CUSTOM', enableStr);
    });
}

// 1. 初始化时同步一次
syncSettings();

// 2. 监听选项页面的更改，实时更新
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.customList) {
            updateLocalStorage('17PLUS_CUSTOM_LIST', JSON.stringify(changes.customList.newValue));
        }
        if (changes.enableCustom) {
            updateLocalStorage('17PLUS_ENABLE_CUSTOM', changes.enableCustom.newValue ? 'true' : 'false');
        }
    }
});