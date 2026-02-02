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
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', togglePanels));