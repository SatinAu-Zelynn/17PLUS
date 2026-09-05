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

let currentPage = 'feature';
let currentMode = 'replace';
let toastTimer = null;

// SatinAu iOS 风格 Toast 提示
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, 1600);
}

// 精确更新指定分段控制器的滑块位置
function updateGlider(controlEl, activeBtn) {
  const glider = controlEl.querySelector('.segment-glider');
  if (glider && activeBtn) {
    glider.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    glider.style.width = `${activeBtn.offsetWidth}px`;
  }
}

// 切换二级主页面 (功能 / 界面)
function setPage(page) {
  currentPage = page;
  const isFeature = page === 'feature';
  
  document.getElementById('page-feature').classList.toggle('active', isFeature);
  document.getElementById('page-ui').classList.toggle('active', !isFeature);

  const nav = document.getElementById('pageNavControl');
  nav.querySelectorAll('.segment-btn').forEach(btn => {
    const active = btn.dataset.page === page;
    btn.classList.toggle('active', active);
    if (active) updateGlider(nav, btn);
  });

  // 切回功能页时重新校准模式滑块
  if (isFeature) {
    const modeControl = document.getElementById('modeControl');
    const activeModeBtn = modeControl.querySelector('.segment-btn.active');
    if (activeModeBtn) updateGlider(modeControl, activeModeBtn);
  }
}

// 切换模式面板及模式分段控制器滑块
function setMode(mode) {
  currentMode = mode;
  const isReplace = mode === 'replace';
  
  document.getElementById('panel-replace').classList.toggle('active', isReplace);
  document.getElementById('panel-modify').classList.toggle('active', !isReplace);

  const control = document.getElementById('modeControl');
  control.querySelectorAll('.segment-btn').forEach(btn => {
    const active = btn.dataset.value === mode;
    btn.classList.toggle('active', active);
    if (active) updateGlider(control, btn);
  });
}

// 初始化分段控制器
function initSegmentedControl() {
  // 主页面切换
  const nav = document.getElementById('pageNavControl');
  nav.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });

  // 模式切换
  const modeControl = document.getElementById('modeControl');
  modeControl.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.value));
  });
}

// 保存设置
function saveOptions() {
  const enableCustom = document.getElementById('enableCustom').checked;
  
  // 界面设置
  const enableAnimation = document.getElementById('enableAnimation').checked;
  const enableBlur = document.getElementById('enableBlur').checked;
  const hideAiChat = document.getElementById('hideAiChat').checked;

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
    },
    enableAnimation,
    enableBlur,
    hideAiChat
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
    modifyConfig: { add: [], del: [], rename: {} },
    enableAnimation: true,
    enableBlur: true,
    hideAiChat: true
  }, (items) => {
    document.getElementById('enableCustom').checked = items.enableCustom;

    // 恢复界面设置
    document.getElementById('enableAnimation').checked = items.enableAnimation;
    document.getElementById('enableBlur').checked = items.enableBlur;
    document.getElementById('hideAiChat').checked = items.hideAiChat;

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

    // 恢复选中的页面与模式及滑块
    setTimeout(() => {
      setPage('feature');
      setMode(items.mode || 'replace');
    }, 50);
  });
}


document.addEventListener('DOMContentLoaded', () => {
  initSegmentedControl();
  restoreOptions();
  document.getElementById('save').addEventListener('click', () => saveOptions());

  // 所有 Toggle 开关变动时均即时保存
  ['enableCustom', 'enableAnimation', 'enableBlur', 'hideAiChat'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      saveOptions();
    });
  });

  // 网络字体加载完成后精准重校滑块尺寸
  if (document.fonts) {
    document.fonts.ready.then(() => {
      setPage(currentPage);
      setMode(currentMode);
    });
  }
});