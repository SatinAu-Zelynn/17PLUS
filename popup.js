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
let visualStudents = [];
let cachedOriginalStudents = [];
let maxOriginalStudentNo = 0;

// 解析原名单项的姓名和学号
function getStudentInfo(item, fallbackIdx) {
  if (typeof item === 'object' && item !== null) {
    let no = item.studentNo;
    if (no === undefined && item.studentNumber) {
      const lastTwo = String(item.studentNumber).slice(-2);
      no = parseInt(lastTwo, 10);
    }
    return {
      name: item.name || item.stuName || '',
      studentNo: isNaN(no) ? fallbackIdx + 1 : no
    };
  }
  return {
    name: String(item || ''),
    studentNo: fallbackIdx + 1
  };
}

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

  // 增删改配置自动计算
  const modifyConfig = computeModifyConfig();

  const config = {
    enableCustom,
    mode: currentMode,
    customList,
    modifyConfig,
    enableAnimation,
    enableBlur,
    hideAiChat
  };

  chrome.storage.local.set(config, () => {
    showToast('设置已保存');
  });
}

// 根据原名单与配置重构可视化列表
function rebuildVisualList(originalList, modifyConfig) {
  const { add = [], del = [], rename = {} } = modifyConfig || {};
  const list = [];
  let idCounter = 1;

  // 解析并按学号排序原名单
  let parsedOriginal = [];
  if (Array.isArray(originalList)) {
    parsedOriginal = originalList.map((item, idx) => getStudentInfo(item, idx));
    parsedOriginal.sort((a, b) => a.studentNo - b.studentNo);
  }

  // 统计原名单中最大的学号
  maxOriginalStudentNo = 0;
  parsedOriginal.forEach(stu => {
    if (stu.studentNo > maxOriginalStudentNo) {
      maxOriginalStudentNo = stu.studentNo;
    }
  });

  // 1. 原名单已排序项（学号固定，删除不影响其余项的学号）
  parsedOriginal.forEach(orig => {
    if (del.includes(orig.name)) return;
    list.push({
      id: idCounter++,
      originalName: orig.name,
      currentName: rename[orig.name] || orig.name,
      studentNo: orig.studentNo
    });
  });

  // 2. 新增名单排在原名单最大学号后依次递增
  let nextNo = maxOriginalStudentNo;
  if (Array.isArray(add)) {
    add.forEach(added => {
      nextNo++;
      list.push({
        id: idCounter++,
        originalName: null,
        currentName: added,
        studentNo: nextNo
      });
    });
  }

  return list;
}

// 渲染可视化学生条目
function renderVisualList() {
  const container = document.getElementById('studentListContainer');
  const countEl = document.getElementById('modifyCount');
  if (!container) return;

  container.innerHTML = '';
  if (countEl) countEl.textContent = visualStudents.length;

  if (visualStudents.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'modify-empty-tip';
    tip.innerHTML = cachedOriginalStudents.length === 0
      ? '暂未检测到网页名单<br>请进入作业班级页面自动同步，或在下方直接添加'
      : '名单已清空，可点击右上角“重置”恢复原名单';
    container.appendChild(tip);
    return;
  }

  visualStudents.forEach(stu => {
    const row = document.createElement('div');
    row.className = 'student-item';

    // 名字前的序号与学号保持一致，删除后已有学号保持不变
    const idxSpan = document.createElement('span');
    idxSpan.className = 'student-idx';
    idxSpan.textContent = String(stu.studentNo).padStart(2, '0');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'student-item-input';
    input.value = stu.currentName;
    input.maxLength = 20;

    input.addEventListener('change', () => {
      const val = input.value.trim();
      if (!val) {
        input.value = stu.currentName;
      } else {
        stu.currentName = val;
        renderVisualList();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });

    row.appendChild(idxSpan);
    row.appendChild(input);

    if (!stu.originalName) {
      const tag = document.createElement('span');
      tag.className = 'student-tag student-tag-new';
      tag.textContent = '新';
      row.appendChild(tag);
    } else if (stu.currentName !== stu.originalName) {
      const tag = document.createElement('span');
      tag.className = 'student-tag student-tag-mod';
      tag.textContent = '改';
      row.appendChild(tag);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-del-item';
    delBtn.title = '删除';
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    delBtn.addEventListener('click', () => {
      visualStudents = visualStudents.filter(item => item.id !== stu.id);
      renderVisualList();
    });

    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// 添加学生：排在原名单最大学号后
function addStudentItem() {
  const input = document.getElementById('addStudentInput');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  // 寻找当前已有的最大学号，至少为 maxOriginalStudentNo
  let currentMax = maxOriginalStudentNo;
  visualStudents.forEach(item => {
    if (item.studentNo > currentMax) {
      currentMax = item.studentNo;
    }
  });

  visualStudents.push({
    id: Date.now() + Math.random(),
    originalName: null,
    currentName: name,
    studentNo: currentMax + 1
  });

  input.value = '';
  renderVisualList();

  const container = document.getElementById('studentListContainer');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// 重置名单为抓取到的原班名单
function resetModifyList() {
  if (cachedOriginalStudents.length === 0) {
    visualStudents = [];
  } else {
    visualStudents = rebuildVisualList(cachedOriginalStudents, { add: [], del: [], rename: {} });
  }
  renderVisualList();
  showToast('已重置为原名单');
}

// 从可视化列表中提取并计算出 modifyConfig
function computeModifyConfig() {
  const del = [];
  const rename = {};
  const add = [];

  cachedOriginalStudents.forEach((orig, idx) => {
    const info = getStudentInfo(orig, idx);
    const matched = visualStudents.find(item => item.originalName === info.name);
    if (!matched) {
      del.push(info.name);
    }
  });

  visualStudents.forEach(item => {
    if (item.originalName) {
      if (item.currentName !== item.originalName) {
        rename[item.originalName] = item.currentName;
      }
    } else {
      if (item.currentName.trim()) {
        add.push(item.currentName.trim());
      }
    }
  });

  return { add, del, rename };
}

// 读取恢复设置
function restoreOptions() {
  chrome.storage.local.get({
    enableCustom: false,
    mode: 'replace',
    customList: [],
    originalStudents: [],
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

    // 恢复可视化增删改列表
    cachedOriginalStudents = items.originalStudents || [];
    visualStudents = rebuildVisualList(cachedOriginalStudents, items.modifyConfig);
    renderVisualList();

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

  document.getElementById('btnAddStudent').addEventListener('click', addStudentItem);
  document.getElementById('addStudentInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addStudentItem();
  });
  document.getElementById('btnResetModify').addEventListener('click', resetModifyList);
});