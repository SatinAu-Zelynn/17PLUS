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

let currentMode = 'replace';

// SatinAu iOS 风格 Toast 提示
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 1600);
}

// 切换面板及分段控制器滑块
function setMode(mode) {
  currentMode = mode;
  const isReplace = mode === 'replace';
  
  document.getElementById('panel-replace').classList.toggle('active', isReplace);
  document.getElementById('panel-modify').classList.toggle('active', !isReplace);

  const glider = document.querySelector('.segment-glider');
  const buttons = document.querySelectorAll('.segment-btn');

  buttons.forEach(btn => {
    const active = btn.dataset.value === mode;
    btn.classList.toggle('active', active);
    if (active && glider) {
      glider.style.transform = `translateX(${btn.offsetLeft}px)`;
      glider.style.width = `${btn.offsetWidth}px`;
    }
  });
}

// 初始化分段控制器
function initSegmentedControl() {
  const buttons = document.querySelectorAll('.segment-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.value);
    });
  });
}

// 保存设置
function saveOptions() {
  const enableCustom = document.getElementById('enableCustom').checked;
  
  // 替换列表
  const replaceListRaw = document.getElementById('customList').value;
  const customList = replaceListRaw.split('\n').map(n => n.trim()).filter(Boolean);

  // 增删改列表
  const addList = document.getElementById('addList').value.split('\n').map(n => n.trim()).filter(Boolean);
  const delList = document.getElementById('delList').value.split('\n').map(n => n.trim()).filter(Boolean);
  
  // 重命名
  const renameRaw = document.getElementById('renameList').value.split('\n');
  const renameMap = {};
  renameRaw.forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2 && parts[0].trim()) {
      renameMap[parts[0].trim()] = parts[1].trim();
    }
  });

  const config = {
    enableCustom,
    mode: currentMode,
    customList,
    modifyConfig: {
      add: addList,
      del: delList,
      rename: renameMap
    }
  };

  chrome.storage.local.set(config, () => {
    showToast('设置已保存');
  });
}

// 读取恢复设置
function restoreOptions() {
  chrome.storage.local.get({
    enableCustom: false,
    mode: 'replace',
    customList: [],
    modifyConfig: { add: [], del: [], rename: {} }
  }, (items) => {
    document.getElementById('enableCustom').checked = items.enableCustom;

    // 填充替换列表
    if (items.customList) {
      document.getElementById('customList').value = items.customList.join('\n');
    }

    // 填充增删改列表
    if (items.modifyConfig) {
      document.getElementById('addList').value = (items.modifyConfig.add || []).join('\n');
      document.getElementById('delList').value = (items.modifyConfig.del || []).join('\n');
      
      const renameText = Object.entries(items.modifyConfig.rename || {})
        .map(([k, v]) => `${k}=${v}`).join('\n');
      document.getElementById('renameList').value = renameText;
    }

    // 恢复选中的模式及动画滑块
    setTimeout(() => {
      setMode(items.mode || 'replace');
    }, 50);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSegmentedControl();
  restoreOptions();
  document.getElementById('save').addEventListener('click', saveOptions);
});