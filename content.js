// 注入拦截脚本 (Hook)
const script = document.createElement('script');
script.src = chrome.runtime.getURL('hook.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);


// 创建 UI 面板
function createSettingsPanel() {
    const panel = document.createElement('div');
    panel.className = 'plus-settings-panel';
    panel.innerHTML = `
        <h3>17PLUS 设置</h3>
        <div class="setting-item">
            <label>
                <input type="checkbox" id="plus-enable-custom"> 启用自定义点名名单
            </label>
        </div>
        <div class="setting-item">
            <textarea id="plus-student-list" placeholder="在此输入名单，每行一个名字"></textarea>
        </div>
        <div class="setting-actions">
            <button id="plus-save-btn">保存并生效</button>
            <span id="plus-msg"></span>
        </div>
        <div class="setting-tip">提示：保存后请刷新页面重新加载资源。</div>
        <button class="plus-close-btn">×</button>
    `;
    document.body.appendChild(panel);

    // 浮动入口按钮
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'plus-toggle-btn';
    toggleBtn.innerText = '⚙️';
    toggleBtn.title = '17PLUS 设置';
    toggleBtn.onclick = () => {
        panel.classList.toggle('active');
        loadSettings();
    };
    document.body.appendChild(toggleBtn);

    // 事件绑定
    panel.querySelector('.plus-close-btn').onclick = () => panel.classList.remove('active');

    const saveBtn = document.getElementById('plus-save-btn');
    const textarea = document.getElementById('plus-student-list');
    const checkbox = document.getElementById('plus-enable-custom');
    const msg = document.getElementById('plus-msg');

    function loadSettings() {
        const savedList = localStorage.getItem('17PLUS_CUSTOM_LIST');
        if (savedList) {
            textarea.value = JSON.parse(savedList).join('\n');
        }
        checkbox.checked = localStorage.getItem('17PLUS_ENABLE_CUSTOM') === 'true';
    }

    saveBtn.onclick = () => {
        const names = textarea.value.split('\n').map(n => n.trim()).filter(n => n);
        localStorage.setItem('17PLUS_CUSTOM_LIST', JSON.stringify(names));
        localStorage.setItem('17PLUS_ENABLE_CUSTOM', checkbox.checked);
        
        msg.innerText = '已保存! 请刷新页面';
        setTimeout(() => msg.innerText = '', 2000);
    };
}

// 等待页面加载后创建 UI
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createSettingsPanel);
} else {
    createSettingsPanel();
}