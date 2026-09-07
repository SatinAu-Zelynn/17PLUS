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
let cachedClasses = [];
let currentClassId = null;
let allModifyConfigs = {};
let visualStudents = [];
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

// 获取当前选中班级的原始学生数组
function getCurrentClassOriginalStudents() {
  const currentCls = cachedClasses.find(c => String(c.classId) === String(currentClassId));
  return currentCls ? currentCls.students : [];
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

// 精确校准班级分段控制器的滑块位置
function updateClassGlider() {
  const control = document.getElementById('classControl');
  if (!control || control.style.display === 'none') return;
  const activeBtn = control.querySelector('.segment-btn.active');
  if (activeBtn) {
    requestAnimationFrame(() => {
      updateGlider(control, activeBtn);
    });
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

  // 切回功能页时重新校准模式滑块及班级滑块
  if (isFeature) {
    const modeControl = document.getElementById('modeControl');
    const activeModeBtn = modeControl.querySelector('.segment-btn.active');
    if (activeModeBtn) updateGlider(modeControl, activeModeBtn);
    if (currentMode === 'modify') {
      updateClassGlider();
    }
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

  // 进入增删改模式时自动校准班级滑块
  if (!isReplace) {
    updateClassGlider();
  }
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
function saveOptions(isReset = false) {
  const enableCustom = document.getElementById('enableCustom').checked;
  
  // 界面设置
  const enableAnimation = document.getElementById('enableAnimation').checked;
  const enableBlur = document.getElementById('enableBlur').checked;
  const hideAiChat = document.getElementById('hideAiChat').checked;

  // 替换列表
  const replaceListRaw = document.getElementById('customList').value;
  const customList = replaceListRaw.split('\n').map(n => n.trim()).filter(Boolean);

  // 增删改配置：保存当前班级的更改至全量配置中
  if (currentClassId !== null) {
    allModifyConfigs[currentClassId] = computeModifyConfig();
  }

  const config = {
    enableCustom,
    mode: currentMode,
    customList,
    modifyConfig: allModifyConfigs,
    enableAnimation,
    enableBlur,
    hideAiChat
  };

  chrome.storage.local.set(config, () => {
    showToast(isReset ? '当前班级已重置为原名单' : '设置已保存');
  });
}

// 切换班级
function switchClass(classId) {
  if (currentClassId !== null) {
    allModifyConfigs[currentClassId] = computeModifyConfig();
  }
  currentClassId = classId;

  const control = document.getElementById('classControl');
  const activeBtn = control.querySelector(`.segment-btn[data-class-id="${classId}"]`);
  control.querySelectorAll('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn === activeBtn);
  });
  if (activeBtn) updateGlider(control, activeBtn);

  const origList = getCurrentClassOriginalStudents();
  const cfg = allModifyConfigs[currentClassId] || { add: [], del: [], rename: {} };
  visualStudents = rebuildVisualList(origList, cfg);
  renderVisualList();
}

// 渲染班级分段控制器
function renderClassControl() {
  const control = document.getElementById('classControl');
  if (!control) return;

  if (cachedClasses.length <= 1) {
    control.style.display = 'none';
    if (cachedClasses.length === 1) {
      currentClassId = cachedClasses[0].classId;
    }
    return;
  }

  control.style.display = 'flex';
  // 移除旧按钮，保留 glider
  control.querySelectorAll('.segment-btn').forEach(btn => btn.remove());

  if (!cachedClasses.some(c => String(c.classId) === String(currentClassId))) {
    currentClassId = cachedClasses[0].classId;
  }

  cachedClasses.forEach(cls => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'segment-btn';
    btn.dataset.classId = cls.classId;
    btn.textContent = cls.className;
    if (String(cls.classId) === String(currentClassId)) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => switchClass(cls.classId));
    control.appendChild(btn);
  });

  const activeBtn = control.querySelector('.segment-btn.active');
  if (activeBtn) updateGlider(control, activeBtn);
}

// 根据原名单与配置重构可视化列表
function rebuildVisualList(originalList, modifyConfig) {
  const { add = [], del = [], rename = {} } = modifyConfig || {};
  const list = [];
  let idCounter = 1;

  let parsedOriginal = [];
  if (Array.isArray(originalList)) {
    parsedOriginal = originalList.map((item, idx) => getStudentInfo(item, idx));
    parsedOriginal.sort((a, b) => a.studentNo - b.studentNo);
  }

  maxOriginalStudentNo = 0;
  parsedOriginal.forEach(stu => {
    if (stu.studentNo > maxOriginalStudentNo) {
      maxOriginalStudentNo = stu.studentNo;
    }
  });

  // 1. 原名单项
  parsedOriginal.forEach(orig => {
    if (del.includes(orig.name)) return;
    list.push({
      id: idCounter++,
      originalName: orig.name,
      currentName: rename[orig.name] || orig.name,
      studentNo: orig.studentNo
    });
  });

  // 2. 新增项
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

// 渲染已修改和已删除状态列表（支持单独点击撤销/恢复）
function renderDiffSummary() {
  const { del, rename } = computeModifyConfig();
  const modGroup = document.getElementById('modGroup');
  const delGroup = document.getElementById('delGroup');
  const modList = document.getElementById('modList');
  const delList = document.getElementById('delList');
  const modCount = document.getElementById('modCount');
  const delCount = document.getElementById('delCount');

  const renameEntries = Object.entries(rename);

  // 已修改
  if (renameEntries.length > 0) {
    modGroup.style.display = 'block';
    modCount.textContent = renameEntries.length;
    modList.innerHTML = '';
    renameEntries.forEach(([oldName, newName]) => {
      const chip = document.createElement('span');
      chip.className = 'diff-chip diff-chip-mod';
      chip.title = '点击撤销修改，恢复原姓名';
      chip.innerHTML = `${oldName} → ${newName} <span class="diff-chip-action">↩</span>`;
      chip.addEventListener('click', () => {
        const target = visualStudents.find(s => s.originalName === oldName);
        if (target) {
          target.currentName = oldName;
          renderVisualList();
        }
      });
      modList.appendChild(chip);
    });
  } else {
    modGroup.style.display = 'none';
  }

  // 已删除
  if (del.length > 0) {
    delGroup.style.display = 'block';
    delCount.textContent = del.length;
    delList.innerHTML = '';
    del.forEach(name => {
      const chip = document.createElement('span');
      chip.className = 'diff-chip diff-chip-del';
      chip.title = '点击恢复该学生';
      chip.innerHTML = `${name} <span class="diff-chip-action">+</span>`;
      chip.addEventListener('click', () => {
        // 恢复被删除的学生，放回原学号顺序
        const origList = getCurrentClassOriginalStudents();
        const origItem = origList.find((s, idx) => getStudentInfo(s, idx).name === name);
        const info = getStudentInfo(origItem, 0);
        visualStudents.push({
          id: Date.now() + Math.random(),
          originalName: name,
          currentName: name,
          studentNo: info.studentNo
        });
        visualStudents.sort((a, b) => a.studentNo - b.studentNo);
        renderVisualList();
      });
      delList.appendChild(chip);
    });
  } else {
    delGroup.style.display = 'none';
  }
}

// 渲染可视化学生条目
function renderVisualList() {
  const container = document.getElementById('studentListContainer');
  const countEl = document.getElementById('modifyCount');
  if (!container) return;

  container.innerHTML = '';
  if (countEl) countEl.textContent = visualStudents.length;

  const currentOrig = getCurrentClassOriginalStudents();
  if (visualStudents.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'modify-empty-tip';
    tip.innerHTML = currentOrig.length === 0
      ? '暂未检测到当前班级名单<br>请进入作业班级页面自动同步，或在下方直接添加'
      : '名单已清空，可点击右上角“重置当前班”恢复原名单';
    container.appendChild(tip);
    renderDiffSummary();
    return;
  }

  visualStudents.forEach(stu => {
    const row = document.createElement('div');
    row.className = 'student-item';

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

  renderDiffSummary();
}

// 重置名单为当前班级的原班名单并立即持久化保存
function resetModifyList() {
  const currentOrig = getCurrentClassOriginalStudents();
  if (currentOrig.length === 0) {
    visualStudents = [];
  } else {
    visualStudents = rebuildVisualList(currentOrig, { add: [], del: [], rename: {} });
  }
  if (currentClassId !== null) {
    allModifyConfigs[currentClassId] = { add: [], del: [], rename: {} };
  }
  renderVisualList();
  saveOptions(true);
}

// 从当前列表中提取并计算出当前班级的 modifyConfig
function computeModifyConfig() {
  const del = [];
  const rename = {};
  const add = [];

  const currentOrig = getCurrentClassOriginalStudents();
  currentOrig.forEach((orig, idx) => {
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
    originalClasses: [],
    originalStudents: [],
    modifyConfig: {},
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

    // 恢复班级列表（兼容旧版本单班级 originalStudents 缓存）与增删改配置
    cachedClasses = (items.originalClasses && items.originalClasses.length > 0)
      ? items.originalClasses
      : (items.originalStudents && items.originalStudents.length > 0
          ? [{ classId: 'default', className: '默认班级', students: items.originalStudents }]
          : []);
    allModifyConfigs = (items.modifyConfig && typeof items.modifyConfig === 'object') ? items.modifyConfig : {};

    renderClassControl();

    const origList = getCurrentClassOriginalStudents();
    const cfg = (currentClassId && allModifyConfigs[currentClassId]) ? allModifyConfigs[currentClassId] : { add: [], del: [], rename: {} };
    visualStudents = rebuildVisualList(origList, cfg);
    renderVisualList();

    // 恢复选中的页面与模式及滑块
    setTimeout(() => {
      setPage('feature');
      setMode(items.mode || 'replace');
      updateClassGlider();
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
      updateClassGlider();
    });
  }

  document.getElementById('btnAddStudent').addEventListener('click', addStudentItem);
  document.getElementById('addStudentInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addStudentItem();
  });
  document.getElementById('btnResetModify').addEventListener('click', resetModifyList);
});