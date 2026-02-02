// 保存设置
function saveOptions() {
    const enableCustom = document.getElementById('enableCustom').checked;
    const listText = document.getElementById('customList').value;
    
    // 将文本转换为数组，去除空行和首尾空格
    const customList = listText.split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0);

    chrome.storage.local.set({
        enableCustom: enableCustom,
        customList: customList
    }, () => {
        // 显示保存成功消息
        const status = document.getElementById('status');
        status.textContent = '设置已保存！';
        
        // 按钮视觉反馈
        const btn = document.getElementById('save');
        const originalText = btn.textContent;
        btn.textContent = '已保存';
        
        setTimeout(() => {
            status.textContent = '';
            btn.textContent = originalText;
        }, 1500);
    });
}

// 加载设置
function restoreOptions() {
    chrome.storage.local.get({
        enableCustom: false,
        customList: []
    }, (items) => {
        document.getElementById('enableCustom').checked = items.enableCustom;
        if (items.customList && Array.isArray(items.customList)) {
            document.getElementById('customList').value = items.customList.join('\n');
        }
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);