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

// --- 自动更新检查逻辑 ---

const UPDATE_API = "https://cdn-cf.satinau.cn/data/version.json";
const CHECK_INTERVAL = 30 * 60 * 1000; // 检查间隔：30分钟

// 版本号对比函数 (return true if v2 > v1)
function hasNewVersion(localVer, remoteVer) {
    if (!remoteVer) return false;
    const v1 = localVer.split('.').map(Number);
    const v2 = remoteVer.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
        const num1 = v1[i] || 0;
        const num2 = v2[i] || 0;
        if (num2 > num1) return true;
        if (num2 < num1) return false;
    }
    return false;
}

// 检查更新主函数
function checkUpdate() {
    chrome.storage.local.get(['lastCheckTime', 'cachedUpdateInfo'], (data) => {
        const now = Date.now();
        const currentVer = chrome.runtime.getManifest().version;

        // 如果缓存中有更新信息，且本地版本仍旧旧于缓存的新版本，先显示缓存的提示
        if (data.cachedUpdateInfo && hasNewVersion(currentVer, data.cachedUpdateInfo.version)) {
            showUpdateUI(data.cachedUpdateInfo.version, data.cachedUpdateInfo.download);
        }

        // 判断是否需要发起网络请求 (超过间隔时间)
        if (!data.lastCheckTime || (now - data.lastCheckTime > CHECK_INTERVAL)) {
            fetch(UPDATE_API)
                .then(response => response.json())
                .then(items => {
                    // 找到 name 为 17plus 的项目
                    const target = items.find(item => item.name === '17plus');
                    if (target && hasNewVersion(currentVer, target.version)) {
                        // 发现新版本，更新缓存并显示
                        const updateInfo = {
                            version: target.version,
                            download: target.download
                        };
                        
                        chrome.storage.local.set({
                            lastCheckTime: now,
                            cachedUpdateInfo: updateInfo
                        });
                        
                        showUpdateUI(target.version, target.download);
                    } else {
                        // 没有新版本，仅更新检查时间，清除旧的更新缓存
                        chrome.storage.local.set({
                            lastCheckTime: now,
                            cachedUpdateInfo: null
                        });
                    }
                })
                .catch(err => console.error("检查更新失败:", err));
        }
    });
}

// 显示更新 UI
function showUpdateUI(version, url) {
    const alertBox = document.getElementById('update-alert');
    const verSpan = document.getElementById('new-version-code');
    const btn = document.getElementById('update-btn');

    if (alertBox && verSpan && btn) {
        verSpan.textContent = `${version}`;
        // 点击按钮打开新标签页
        btn.onclick = (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: url });
        };
        alertBox.style.display = 'block';
    }
}

function togglePanels() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    document.getElementById('panel-replace').classList.toggle('active', mode === 'replace');
    document.getElementById('panel-modify').classList.toggle('active', mode === 'modify');
}

// 保存设置
function saveOptions() {
    const enableCustom = document.getElementById('enableCustom').checked;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    // 获取替换列表
    const replaceListRaw = document.getElementById('customList').value;
    const customList = replaceListRaw.split('\n').map(n => n.trim()).filter(n => n);

    // 获取增删改配置
    const addList = document.getElementById('addList').value.split('\n').map(n => n.trim()).filter(n => n);
    const delList = document.getElementById('delList').value.split('\n').map(n => n.trim()).filter(n => n);
    
    // 解析重命名 "Old=New"
    const renameRaw = document.getElementById('renameList').value.split('\n');
    const renameMap = {};
    renameRaw.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            renameMap[parts[0].trim()] = parts[1].trim();
        }
    });

    const config = {
        enableCustom,
        mode, // 'replace' or 'modify'
        customList,
        modifyConfig: {
            add: addList,
            del: delList,
            rename: renameMap
        }
    };

    chrome.storage.local.set(config, () => {
        const status = document.getElementById('status');
        status.textContent = '设置已保存！';
        setTimeout(() => status.textContent = '', 1500);
    });
}

// 加载设置
function restoreOptions() {
    chrome.storage.local.get({
        enableCustom: false,
        mode: 'replace',
        customList: [],
        modifyConfig: { add: [], del: [], rename: {} }
    }, (items) => {
        document.getElementById('enableCustom').checked = items.enableCustom;
        
        // 设置模式单选框
        const radios = document.getElementsByName('mode');
        for (let r of radios) {
            if (r.value === items.mode) r.checked = true;
        }

        // 填充替换列表
        if (items.customList) document.getElementById('customList').value = items.customList.join('\n');

        // 填充增删改列表
        if (items.modifyConfig) {
            document.getElementById('addList').value = items.modifyConfig.add.join('\n');
            document.getElementById('delList').value = items.modifyConfig.del.join('\n');
            
            // 还原 renameMap 为文本
            const renameText = Object.entries(items.modifyConfig.rename)
                .map(([k, v]) => `${k}=${v}`).join('\n');
            document.getElementById('renameList').value = renameText;
        }

        togglePanels(); // 初始化面板显示
        checkUpdate();
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', togglePanels));