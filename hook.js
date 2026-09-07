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
                    const capturedClasses = json.data.classList.map(cls => {
                        const rawStudents = (cls.studentList || []).map(s => {
                            const numStr = String(s.studentNumber || '').slice(-2);
                            const sNo = parseInt(numStr, 10);
                            return {
                                name: s.stuName,
                                studentNumber: s.studentNumber,
                                studentNo: isNaN(sNo) ? 0 : sNo
                            };
                        }).filter(s => s.name);
                        return {
                            classId: cls.classId,
                            className: cls.className || `班级(${cls.classId})`,
                            students: rawStudents
                        };
                    });
                    notifyOriginalClasses(capturedClasses);

                    json.data.classList.forEach(cls => {
                        // 字段映射：该接口使用 stuName, stuId, studentNumber
                        const adapter = {
                            nameField: 'stuName',
                            idField: 'stuId',
                            createItem: (name, idx, stuNo) => {
                                const noStr = stuNo !== undefined ? String(stuNo).padStart(2, '0') : String(idx + 1).padStart(2, '0');
                                return {
                                    stuId: 880000000 + idx,
                                    studentNumber: "2025" + noStr,
                                    stuName: name
                                };
                            }
                        };
                        
                        cls.studentList = applyListLogic(cls.studentList, config, adapter, cls.classId);
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

                        cls.list = applyListLogic(cls.list, config, adapter, cls.classId);
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
    function applyListLogic(originalList, config, adapter, classId) {
        let resultList = [];

        const getNo = (item) => {
            const num = parseInt(String(item.studentNumber || '').slice(-2), 10);
            return isNaN(num) ? 0 : num;
        };

        // 按 studentNumber 的最后两位学号升序排序
        let sortedOriginal = originalList ? [...originalList] : [];
        sortedOriginal.sort((a, b) => getNo(a) - getNo(b));

        // 获取原名单中最大的学号
        let maxOrigNo = 0;
        sortedOriginal.forEach(item => {
            const no = getNo(item);
            if (no > maxOrigNo) maxOrigNo = no;
        });

        // === 完全替换 ===
        if (config.mode === 'replace') {
            if (config.replaceList && config.replaceList.length > 0) {
                resultList = config.replaceList.map((name, i) => adapter.createItem(name, i));
            } else {
                resultList = sortedOriginal;
            }
        } 
        
        // === 增删改 ===
        else if (config.mode === 'modify') {
            // 获取对应班级的配置，向前兼容旧版结构
            const classConfig = (config.modifyConfig && classId && config.modifyConfig[classId])
                ? config.modifyConfig[classId]
                : (config.modifyConfig && Array.isArray(config.modifyConfig.add) ? config.modifyConfig : { add: [], del: [], rename: {} });
            const { add, del, rename } = classConfig;
            
            // 复制按学号排好序的原始列表
            let currentList = [...sortedOriginal];

            // 执行删除 (Filter) - 删除某人后，其余人员保持原学号与顺序不变
            if (del && del.length > 0) {
                currentList = currentList.filter(item => {
                    const name = item[adapter.nameField];
                    return !del.includes(name);
                });
            }

            // 执行修改 (Map)
            if (rename) {
                currentList.forEach(item => {
                    const oldName = item[adapter.nameField];
                    if (rename[oldName]) {
                        item[adapter.nameField] = rename[oldName];
                    }
                });
            }

            // 执行添加 (Push) - 学号在原名单最大学号之后依次递增
            if (add && add.length > 0) {
                const newItems = add.map((name, i) => {
                    const newNo = maxOrigNo + 1 + i;
                    return adapter.createItem(name, i, newNo);
                });
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

function notifyOriginalClasses(classes) {
    if (!Array.isArray(classes) || classes.length === 0) return;
    try {
        localStorage.setItem('17PLUS_ORIGINAL_CLASSES', JSON.stringify(classes));
    } catch (e) {}
    window.postMessage({ type: '17PLUS_CAPTURED_CLASSES', classes: classes }, '*');
}