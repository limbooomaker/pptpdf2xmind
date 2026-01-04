const JSZip = require('jszip');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function md5Hash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}

function collectLeafNodes(node, leaves = []) {
    if (!node.children || node.children.length === 0) {
        leaves.push(node);
    } else {
        node.children.forEach(child => collectLeafNodes(child, leaves));
    }
    return leaves;
}



// 检测是否为倒数第一或第二层级（可以插入图片的层级）
function canInsertImage(node) {
    // 允许倒数第一层级（叶子节点）和倒数第二层级插入图片
    if (!node.children || node.children.length === 0) {
        return true; // 叶子节点
    }
    
    // 检查是否为倒数第二层级（所有子节点都是叶子节点）
    const allChildrenAreLeafs = node.children.every(child => 
        !child.children || child.children.length === 0
    );
    
    return allChildrenAreLeafs;
}

// 图片去重和层级合并功能
function optimizeKnowledgeTree(knowledgeTree) {
    // 简化优化策略：只保留叶子节点的source_pages，非叶子节点移除source_pages
    function removeNonLeafSourcePages(node) {
        if (node.children && node.children.length > 0) {
            // 非叶子节点，移除source_pages
            delete node.source_pages;
            
            // 递归处理子节点
            node.children.forEach(child => removeNonLeafSourcePages(child));
        }
        // 叶子节点保留source_pages
        return node;
    }
    
    return removeNonLeafSourcePages(JSON.parse(JSON.stringify(knowledgeTree)));
}

// 专门处理图片重复问题的函数
function handleDuplicateImages(knowledgeTree) {
    const treeCopy = JSON.parse(JSON.stringify(knowledgeTree));
    
    // 递归遍历树，找到并处理重复图片引用
    function processNode(node, parent) {
        if (!node.children || node.children.length === 0) {
            return; // 叶子节点，不需要处理
        }
        
        // 检查当前节点的子节点中是否有重复图片引用
        const childLeafNodes = [];
        node.children.forEach(child => {
            if (!child.children || child.children.length === 0) {
                childLeafNodes.push(child);
            }
        });
        
        // 统计子叶子节点中每个页面被引用的次数
        const pageReferenceCount = {};
        childLeafNodes.forEach(child => {
            if (child.source_pages && child.source_pages.length > 0) {
                child.source_pages.forEach(page => {
                    pageReferenceCount[page] = (pageReferenceCount[page] || 0) + 1;
                });
            }
        });
        
        // 找出被多次引用的页面
        const duplicatePages = Object.keys(pageReferenceCount)
            .filter(page => pageReferenceCount[page] > 1)
            .map(page => parseInt(page));
        
        // 处理每个重复页面
        duplicatePages.forEach(duplicatePage => {
            console.log(`发现重复图片页面 ${duplicatePage}，在节点 "${node.title}" 的子节点中`);
            
            // 找到引用该页面的所有子叶子节点
            const nodesToMerge = childLeafNodes.filter(child => 
                child.source_pages && child.source_pages.includes(duplicatePage)
            );
            
            if (nodesToMerge.length <= 1) {
                return; // 只有一个节点引用，不需要合并
            }
            
            console.log(`需要合并 ${nodesToMerge.length} 个节点`);
            
            // 创建合并后的节点
            const mergedNode = {
                title: `${node.title}概述`,
                source_pages: [duplicatePage],
                children: []
            };
            
            // 从原节点列表中移除要合并的节点
            const remainingNodes = node.children.filter(child => 
                !nodesToMerge.includes(child)
            );
            
            // 添加合并后的节点
            remainingNodes.push(mergedNode);
            node.children = remainingNodes;
            
            console.log(`✅ 成功合并 ${nodesToMerge.length} 个节点为 "${mergedNode.title}"`);
        });
        
        // 递归处理子节点
        node.children.forEach(child => {
            processNode(child, node);
        });
    }
    
    processNode(treeCopy);
    return treeCopy;
}



async function generateXMind(pagesData, knowledgeTree, originalName, sessionId, outputDir) {
    const zip = new JSZip();
    const { v4: uuidv4 } = require('uuid');
    
    // 使用原始文件名，仅将扩展名从.pdf改为.xmind
    const baseName = path.basename(originalName); // 保留原始文件名和扩展名
    
    // 生成显示用的文件名（保持与上传文件相同的名称）
    const displayFilename = baseName.replace(/\.pdf$/i, '.xmind');
    
    // 对于文件系统操作，使用ASCII-only文件名避免编码问题
    // 使用MD5哈希生成唯一的ASCII文件名
    const safeFilename = `${sessionId}.xmind`;
    const outputPath = path.join(outputDir, safeFilename);
    
    console.log('原始文件名:', baseName);
    console.log('显示文件名:', displayFilename);
    console.log('安全文件名:', safeFilename);
    console.log('输出路径:', outputPath);

    // 优化知识树结构：图片去重和层级合并（限制最大深度）
    let optimizedTree = optimizeKnowledgeTree(JSON.parse(JSON.stringify(knowledgeTree)));
    
    // 专门处理图片重复问题
    optimizedTree = handleDuplicateImages(optimizedTree);
    
    const leafNodes = collectLeafNodes(optimizedTree);
    const imageMap = {};
    const resources = zip.folder('resources');

    // 处理所有叶子节点，不限制数量
    for (const leaf of leafNodes) {
        if (leaf.source_pages && leaf.source_pages.length > 0) {
            const pageNumbers = leaf.source_pages.sort((a, b) => a - b);
            
            // 处理所有相关页面，不限制数量
            for (const pageNum of pageNumbers) {
                const pageData = pagesData.find(p => p.page_num === pageNum);
                if (pageData && fs.existsSync(pageData.image_path)) {
                    const imageBuffer = fs.readFileSync(pageData.image_path);
                    const imageHash = md5Hash(imageBuffer);
                    const imageName = `${imageHash}.png`;
                    
                    const pageKey = `${pageNum}`;
                    if (!imageMap[pageKey]) {
                        imageMap[pageKey] = [];
                    }
                    imageMap[pageKey].push(`xap:resources/${imageName}`);
                    resources.file(imageName, imageBuffer);
                }
            }
        }
    }

    const idCounter = (function*() {
        let i = 0;
        while (true) yield i++;
    })();

    // 根据官方XMind格式重写createTopicNode函数
    function createTopicNode(topic, idCounter, imageMap, parentTopicId = null, level = 0) {
        const topicId = `${idCounter.next().value}`;
        
        const node = {
            id: topicId,
            class: 'topic',
            title: topic.title || '',
            titleUnedited: true
        };

        if (parentTopicId) {
            node.parentId = parentTopicId;
        }
        
        // 设置布局 - 只向右延伸
        if (level === 0) {
            // 根节点使用中心布局
            node.structureClass = 'org.xmind.ui.map.clockwise';
        } else {
            // 所有子节点都使用右侧布局
            node.structureClass = 'org.xmind.ui.logic.right';
        }

        // 根据官方格式，children应该是对象，包含attached数组
        const children = [];
        if (topic.children && topic.children.length > 0) {
            topic.children.forEach(child => {
                children.push(createTopicNode(child, idCounter, imageMap, topicId, level + 1));
            });
        }
        
        if (children.length > 0) {
            node.children = {
                attached: children
            };
        }

        // 调试日志：跟踪"合并主题"节点的处理
        if (topic.title && topic.title.includes('合并主题')) {
            console.log(`\n=== 调试：处理"合并主题"节点 ===`);
            console.log(`节点标题: ${topic.title}`);
            console.log(`层级: ${level}`);
            console.log(`是否有子节点: ${topic.children ? topic.children.length : 0}`);
            console.log(`canInsertImage结果: ${canInsertImage(topic)}`);
            console.log(`source_pages: ${topic.source_pages ? JSON.stringify(topic.source_pages) : '无'}`);
            console.log(`优化后是否有children: ${node.children ? '是' : '否'}`);
        }

        // 插入图片 - 允许倒数第一层级（叶子节点）和倒数第二层级插入图片
        // 支持一个知识点关联多张图片
        if (canInsertImage(topic) && topic.source_pages && topic.source_pages.length > 0) {
            const pageNumbers = topic.source_pages.sort((a, b) => a - b);
            
            // 收集所有相关的图片
            const images = [];
            for (const pageNum of pageNumbers) {
                const pageKey = `${pageNum}`;
                if (imageMap[pageKey] && Array.isArray(imageMap[pageKey])) {
                    // 添加该页面对应的所有图片
                    images.push(...imageMap[pageKey]);
                }
            }
            
            // 插入所有相关图片（XMind支持多个图片附件）
            if (images.length > 0) {
                // 第一个图片作为主图片
                node.image = {
                    src: images[0]
                };
                
                // 其他图片作为附加图片
                if (images.length > 1) {
                    node.attachments = images.slice(1).map((src, index) => ({
                        id: `attachment-${topicId}-${index}`,
                        resourceId: src.replace('xap:resources/', '')
                    }));
                }
                
                // 调试日志：记录图片插入
                if (topic.title && topic.title.includes('合并主题')) {
                    console.log(`⚠️ 插入图片到"合并主题"节点！`);
                    console.log(`图片源: ${JSON.stringify(images)}`);
                }
            }
        } else if (topic.title && topic.title.includes('合并主题')) {
            console.log(`✅ "合并主题"节点未插入图片（正确行为）`);
        }

        return node;
    }

    const rootTopic = createTopicNode(optimizedTree, idCounter, imageMap);

    const sheetId = uuidv4();
    
    // 根据官方格式，content.json应该是数组，包含sheet对象
    const contentJson = [{
        id: sheetId,
        revisionId: uuidv4(),
        class: 'sheet',
        rootTopic: rootTopic,
        title: originalName,
        topicOverlapping: 'overlap',
        extensions: [{
            provider: 'org.xmind.ui.skeleton.structure.style',
            content: {
                centralTopic: 'org.xmind.ui.map.clockwise',
                mainTopic: 'org.xmind.ui.logic.right'
            }
        }],
        theme: {
            centralTopic: {
                id: uuidv4(),
                properties: {
                    'fo:font-family': 'NeverMind',
                    'fo:font-size': '30pt',
                    'fo:font-weight': '800',
                    'fo:font-style': 'normal',
                    'fo:color': 'inherited',
                    'fo:text-transform': 'manual',
                    'fo:text-decoration': 'none',
                    'fo:text-align': 'center',
                    'svg:fill': '#000000',
                    'fill-pattern': 'none',
                    'line-width': '2pt',
                    'line-color': '#ADADAD',
                    'line-pattern': 'solid',
                    'border-line-color': '#000000',
                    'border-line-width': '0pt',
                    'border-line-pattern': 'inherited',
                    'shape-class': 'org.xmind.topicShape.roundedRect',
                    'line-class': 'org.xmind.branchConnection.curve',
                    'arrow-end-class': 'org.xmind.arrowShape.none',
                    'alignment-by-level': 'inherited'
                }
            },
            mainTopic: {
                id: uuidv4(),
                properties: {
                    'fo:font-family': 'NeverMind',
                    'fo:font-size': '18pt',
                    'fo:font-weight': '500',
                    'fo:font-style': 'normal',
                    'fo:color': 'inherited',
                    'fo:text-transform': 'manual',
                    'fo:text-decoration': 'none',
                    'fo:text-align': 'left',
                    'svg:fill': 'inherited',
                    'fill-pattern': 'solid',
                    'line-width': '2pt',
                    'line-color': 'inherited',
                    'line-pattern': 'inherited',
                    'border-line-color': 'inherited',
                    'border-line-width': '0pt',
                    'border-line-pattern': 'inherited',
                    'shape-class': 'org.xmind.topicShape.roundedRect',
                    'line-class': 'org.xmind.branchConnection.roundedElbow',
                    'arrow-end-class': 'inherited',
                    'alignment-by-level': 'inherited'
                }
            }
        }
    }];

    const manifestJson = {
        'manifest-version': '3',
        'file-entries': {
            'content.json': {},
            'content.xml': {},
            'metadata.json': {},
            'manifest.json': {},
            'Thumbnails/thumbnail.png': {}
        }
    };

    Object.keys(imageMap).forEach(key => {
        const imageSrcs = imageMap[key];
        if (Array.isArray(imageSrcs)) {
            imageSrcs.forEach(imageSrc => {
                const imageName = imageSrc.replace('xap:resources/', '');
                manifestJson['file-entries'][`resources/${imageName}`] = {};
            });
        }
    });

    const metadataJson = {
        dataStructureVersion: '2',
        layoutEngineVersion: '4',
        creator: {
            name: 'SlideMind',
            version: '1.0.0'
        },
        familyId: `local-${uuidv4().replace(/-/g, '').substring(0, 24)}`,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        format: 'xmind',
        version: '2020'
    };

    zip.file('content.json', JSON.stringify(contentJson, null, 2));
    
    const contentXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" modified-by="SlideMind" timestamp="${Date.now()}" version="2.0">
    <sheet id="${sheetId}" modified-by="SlideMind" theme="${uuidv4()}" timestamp="${Date.now()}">
        <title>${originalName}</title>
        <topic id="${rootTopic.id}" modified-by="SlideMind" structure-class="org.xmind.ui.logic.right" timestamp="${Date.now()}">
            <title>${rootTopic.title}</title>
        </topic>
    </sheet>
</xmap-content>`;
    zip.file('content.xml', contentXml);
    
    zip.file('manifest.json', JSON.stringify(manifestJson, null, 2));
    zip.file('metadata.json', JSON.stringify(metadataJson, null, 2));
    
    // 创建简单的缩略图（16x16像素的透明PNG）
    const thumbnailBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0xF3, 0xFF, 0x61, 0x00, 0x00, 0x00,
        0x01, 0x73, 0x52, 0x47, 0x42, 0x00, 0xAE, 0xCE, 0x1C, 0xE9, 0x00, 0x00,
        0x00, 0x04, 0x67, 0x41, 0x4D, 0x41, 0x00, 0x00, 0xB1, 0x8F, 0x0B, 0xFC,
        0x61, 0x05, 0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00,
        0x0E, 0xC3, 0x00, 0x00, 0x0E, 0xC3, 0x01, 0xC7, 0x6F, 0xA8, 0x64, 0x00,
        0x00, 0x00, 0x18, 0x49, 0x44, 0x41, 0x54, 0x38, 0x4F, 0x63, 0xFC, 0x0F,
        0x04, 0x8C, 0x0C, 0x0C, 0x0C, 0x4C, 0x40, 0xFC, 0x1F, 0x88, 0x19, 0x19,
        0x18, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0xFC, 0xF7, 0x81,
        0xFD, 0x77, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
        0x60, 0x82
    ]);
    zip.file('Thumbnails/thumbnail.png', thumbnailBuffer);

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, content);

    return {
        filePath: outputPath,
        displayFilename: displayFilename,
        safeFilename: safeFilename
    };
}

module.exports = { 
    generateXMind,
    optimizeKnowledgeTree,
    canInsertImage
};