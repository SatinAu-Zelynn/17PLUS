/*
  Copyright 2026 缎金SatinAu

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

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

function updateLocalStorage(key, value) {
    if (value === undefined || value === null) {
        localStorage.removeItem(key);
    } else {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
}

function syncSettings() {
    chrome.storage.local.get(['customList', 'enableCustom', 'mode', 'modifyConfig'], (items) => {
        // 同步开关
        updateLocalStorage('17PLUS_ENABLE', items.enableCustom ? 'true' : 'false');
        
        // 同步模式
        updateLocalStorage('17PLUS_MODE', items.mode || 'replace');

        // 同步替换列表
        if (items.customList) {
            updateLocalStorage('17PLUS_LIST_REPLACE', items.customList);
        }

        // 同步增删改配置
        if (items.modifyConfig) {
            updateLocalStorage('17PLUS_CONFIG_MODIFY', items.modifyConfig);
        }
    });
}

// 初始化同步
syncSettings();

// 监听变化
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        syncSettings(); // 简单起见，任何变化都重新全量同步一次
    }
});