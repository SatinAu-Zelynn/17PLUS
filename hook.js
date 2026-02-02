(function() {
    console.log('[17PLUS] Hook injected (Enhanced Mode).');

    // === 读取配置工具函数 ===
    function getConfig() {
        try {
            return {
                enabled: localStorage.getItem('17PLUS_ENABLE') === 'true',
                mode: localStorage.getItem('17PLUS_MODE') || 'replace', // 'replace' | 'modify'
                replaceList: JSON.parse(localStorage.getItem('17PLUS_LIST_REPLACE') || '[]'),
                modifyConfig: JSON.parse(localStorage.getItem('17PLUS_CONFIG_MODIFY') || '{"add":[],"del":[],"rename":{}}')
            };
        } catch (e) { return null; }
    }

    const originalXHR = window.XMLHttpRequest;
    const originalOpen = originalXHR.prototype.open;
    const originalSend = originalXHR.prototype.send;

    originalXHR.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    originalXHR.prototype.send = function(body) {
        const config = getConfig();
        if (config && config.enabled) {
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4) {
                    processResponse(this, config);
                }
            });
        }
        return originalSend.apply(this, arguments);
    };

    function processResponse(xhr, config) {
        const url = xhr._url;
        
        // 班级配置接口 (queryConfigData)
        if (url.includes('queryConfigData.vpage')) {
            try {
                const json = JSON.parse(xhr.responseText);
                if (json.data && json.data.classList) {
                    json.data.classList.forEach(cls => {
                        // 字段映射：该接口使用 stuName, stuId, studentNumber
                        const adapter = {
                            nameField: 'stuName',
                            idField: 'stuId',
                            createItem: (name, idx) => ({
                                stuId: 880000000 + idx, // 使用大额ID避免冲突
                                studentNumber: "C" + (20250000 + idx),
                                stuName: name
                            })
                        };
                        
                        cls.studentList = applyListLogic(cls.studentList, config, adapter);
                        cls.allHaveStuNumber = 1;
                    });
                    overrideResponse(xhr, json);
                }
            } catch (e) { console.error('[17PLUS] Config patch error', e); }
        }

        // 奖励接口 (queryTodayMultiClassReward)
        else if (url.includes('queryTodayMultiClassReward.vpage')) {
            try {
                const json = JSON.parse(xhr.responseText);
                if (json.data && Array.isArray(json.data)) {
                    json.data.forEach(cls => {
                        // 字段映射：该接口使用 studentName, studentId, avatorUrl
                        const adapter = {
                            nameField: 'studentName',
                            idField: 'studentId',
                            createItem: (name, idx) => ({
                                studentId: 880000000 + idx,
                                score: 0,
                                isDefaultAvatorImg: 1,
                                studentName: name,
                                avatorUrl: "https://cdn-jiaoxue.17zuoye.cn/jiaoxue-point-matrix-pen/icon/avator_default.png"
                            })
                        };

                        cls.list = applyListLogic(cls.list, config, adapter);
                    });
                    overrideResponse(xhr, json);
                }
            } catch (e) { console.error('[17PLUS] Reward patch error', e); }
        }
    }

    /**
     * 通用名单处理逻辑
     * @param {Array} originalList 原始数据列表
     * @param {Object} config 全局配置对象
     * @param {Object} adapter 针对不同接口的字段适配器
     */
    function applyListLogic(originalList, config, adapter) {
        let resultList = [];

        // === 完全替换 ===
        if (config.mode === 'replace') {
            if (config.replaceList && config.replaceList.length > 0) {
                resultList = config.replaceList.map((name, i) => adapter.createItem(name, i));
            } else {
                resultList = originalList; // 如果替换列表为空，保持原样
            }
        } 
        
        // === 增删改 ===
        else if (config.mode === 'modify') {
            const { add, del, rename } = config.modifyConfig;
            
            // 复制原始列表
            let currentList = originalList ? [...originalList] : [];

            // 执行删除 (Filter)
            // 如果 del 列表包含该名字，则过滤掉
            if (del && del.length > 0) {
                currentList = currentList.filter(item => {
                    const name = item[adapter.nameField];
                    return !del.includes(name);
                });
            }

            // 执行修改 (Map)
            // 检查 rename Map 是否有匹配的 key
            if (rename) {
                currentList.forEach(item => {
                    const oldName = item[adapter.nameField];
                    if (rename[oldName]) {
                        item[adapter.nameField] = rename[oldName];
                    }
                });
            }

            // 执行添加 (Push)
            if (add && add.length > 0) {
                const newItems = add.map((name, i) => adapter.createItem(name, Date.now() + i));
                currentList = currentList.concat(newItems);
            }

            resultList = currentList;
        }

        return resultList;
    }

    function overrideResponse(xhr, json) {
        const newText = JSON.stringify(json);
        Object.defineProperty(xhr, 'responseText', { value: newText });
        Object.defineProperty(xhr, 'response', { value: newText });
        console.log('[17PLUS] 名单数据已修改');
    }
})();