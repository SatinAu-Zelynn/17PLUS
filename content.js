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
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
}

let cachedUISettings = {
    enableAnimation: true,
    enableBlur: true,
    hideAiChat: true
};

function applyUISettings(items) {
    if (items) {
        cachedUISettings = {
            enableAnimation: items.enableAnimation !== false,
            enableBlur: items.enableBlur !== false,
            hideAiChat: items.hideAiChat !== false
        };
    }

    const updateClasses = () => {
        const root = document.documentElement;
        if (!root) return;
        root.classList.toggle('plus-disable-anim', !cachedUISettings.enableAnimation);
        root.classList.toggle('plus-disable-blur', !cachedUISettings.enableBlur);
        root.classList.toggle('plus-hide-ai', cachedUISettings.hideAiChat);
    };

    updateClasses();

    // 网页加载各阶段持续确保 class 存在，防止被页面原生 HTML 覆盖
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateClasses, { once: true });
    }
}

// 监听根节点 class 变动，防止页面框架（Vue/Element 等）挂载时重写冲掉插件标记
const classObserver = new MutationObserver(() => {
    const root = document.documentElement;
    if (!root) return;
    const disableAnim = !cachedUISettings.enableAnimation;
    const disableBlur = !cachedUISettings.enableBlur;
    const hideAi = cachedUISettings.hideAiChat;

    if (root.classList.contains('plus-disable-anim') !== disableAnim ||
        root.classList.contains('plus-disable-blur') !== disableBlur ||
        root.classList.contains('plus-hide-ai') !== hideAi) {
        root.classList.toggle('plus-disable-anim', disableAnim);
        root.classList.toggle('plus-disable-blur', disableBlur);
        root.classList.toggle('plus-hide-ai', hideAi);
    }
});

if (document.documentElement) {
    classObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        classObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }, { once: true });
}

function syncSettings() {
    chrome.storage.local.get({
        customList: [],
        enableCustom: false,
        mode: 'replace',
        modifyConfig: { add: [], del: [], rename: {} },
        enableAnimation: true,
        enableBlur: true,
        hideAiChat: true
    }, (items) => {
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

        // 应用界面外观设置
        applyUISettings(items);
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