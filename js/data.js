/* ============ 学升题库数据 ============ */
/* 题目结构：
   { id, bank, kp(知识点), diff(1-3难度), q(题干), opts:["..","..","..",".."], ans(0-3索引), explain, type: 'single'|'judge' }
*/

const QUESTION_BANKS = [
  {
    id: 'kyzz',
    name: '考研政治',
    desc: '马原·毛中特·史纲·思修',
    color: '#EF4444',
    icon: 'book',
    kps: ['马克思主义基本原理', '毛泽东思想和中国特色社会主义理论', '中国近现代史纲要', '思想道德修养'],
    questions: [
      { id: 'kyzz1', kp: '马克思主义基本原理', diff: 2, q: '马克思主义哲学认为，物质的唯一特性是（　）', opts: ['客观实在性', '运动性', '时空性', '可知性'], ans: 0, explain: '物质的唯一特性是客观实在性，运动是物质的根本属性和存在方式。', type: 'single' },
      { id: 'kyzz2', kp: '马克思主义基本原理', diff: 1, q: '哲学上的两大基本派别是（　）', opts: ['唯物主义和唯心主义', '辩证法和形而上学', '可知论和不可知论', '一元论和二元论'], ans: 0, explain: '哲学基本问题第一方面即思维和存在何者为第一性，划分出唯物主义与唯心主义两大基本派别。', type: 'single' },
      { id: 'kyzz3', kp: '马克思主义基本原理', diff: 2, q: '“沉舟侧畔千帆过，病树前头万木春”体现的哲学道理是（　）', opts: ['新生事物必然战胜旧事物', '事物发展是循环往复的', '矛盾具有同一性', '量变必然引起质变'], ans: 0, explain: '诗句表达新事物不断产生并取代旧事物，体现发展的实质是新生事物必然战胜旧事物。', type: 'single' },
      { id: 'kyzz4', kp: '马克思主义基本原理', diff: 3, q: '真理和谬误的根本区别在于（　）', opts: ['是否与客观实际相符合', '是否被多数人接受', '是否具有逻辑性', '是否对人有用'], ans: 0, explain: '真理是人们对客观事物及其规律的正确反映，与谬误的根本区别在于是否与客观实际相符合。', type: 'single' },
      { id: 'kyzz5', kp: '马克思主义基本原理', diff: 2, q: '唯物辩证法的实质和核心是（　）', opts: ['对立统一规律', '质量互变规律', '否定之否定规律', '联系和发展'], ans: 0, explain: '对立统一规律揭示了事物发展的源泉和动力，是唯物辩证法的实质和核心。', type: 'single' },
      { id: 'kyzz6', kp: '马克思主义基本原理', diff: 1, q: '实践是认识的基础，认识对实践具有反作用。这属于（　）的观点。', opts: ['辩证唯物主义认识论', '主观唯心主义', '机械唯物主义', '经验主义'], ans: 0, explain: '辩证唯物主义认识论认为实践是认识的来源、动力、检验标准和目的，认识反作用于实践。', type: 'single' },
      { id: 'kyzz7', kp: '毛泽东思想和中国特色社会主义理论', diff: 2, q: '中国共产党思想路线的核心是（　）', opts: ['实事求是', '解放思想', '与时俱进', '求真务实'], ans: 0, explain: '党的思想路线是一切从实际出发，理论联系实际，实事求是，在实践中检验真理和发展真理，核心是实事求是。', type: 'single' },
      { id: 'kyzz8', kp: '毛泽东思想和中国特色社会主义理论', diff: 2, q: '我国的根本政治制度是（　）', opts: ['人民代表大会制度', '中国共产党领导的多党合作和政治协商制度', '民族区域自治制度', '基层群众自治制度'], ans: 0, explain: '人民代表大会制度是我国的根本政治制度，其他三项属于基本政治制度。', type: 'single' },
      { id: 'kyzz9', kp: '毛泽东思想和中国特色社会主义理论', diff: 1, q: '中国特色社会主义进入新时代，我国社会主要矛盾是（　）', opts: ['人民日益增长的美好生活需要和不平衡不充分的发展之间的矛盾', '人民日益增长的物质文化需要同落后的社会生产之间的矛盾', '生产关系与生产力之间的矛盾', '经济基础与上层建筑之间的矛盾'], ans: 0, explain: '新时代我国社会主要矛盾已经转化为人民日益增长的美好生活需要和不平衡不充分的发展之间的矛盾。', type: 'single' },
      { id: 'kyzz10', kp: '中国近现代史纲要', diff: 2, q: '标志着中国新民主主义革命开端的事件是（　）', opts: ['五四运动', '辛亥革命', '南昌起义', '新文化运动'], ans: 0, explain: '五四运动标志着中国新民主主义革命的开端，促进了马克思主义在中国的传播。', type: 'single' },
      { id: 'kyzz11', kp: '中国近现代史纲要', diff: 2, q: '遵义会议召开的时间是（　）', opts: ['1935年1月', '1934年10月', '1936年12月', '1937年7月'], ans: 0, explain: '遵义会议于1935年1月在长征途中召开，是党的历史上一个生死攸关的转折点。', type: 'single' },
      { id: 'kyzz12', kp: '中国近现代史纲要', diff: 1, q: '辛亥革命最大的历史功绩是（　）', opts: ['推翻了清王朝统治，结束了君主专制制度', '完成了反帝反封建的任务', '建立了社会主义制度', '实现了民族独立'], ans: 0, explain: '辛亥革命推翻了清王朝，结束了延续两千多年的君主专制制度，这是其最大的历史功绩。', type: 'single' },
      { id: 'kyzz13', kp: '思想道德修养', diff: 1, q: '当代中国精神的集中体现是（　）', opts: ['社会主义核心价值观', '民族精神', '时代精神', '爱国主义'], ans: 0, explain: '社会主义核心价值观是当代中国精神的集中体现，凝结着全体人民共同的价值追求。', type: 'single' },
      { id: 'kyzz14', kp: '思想道德修养', diff: 2, q: '新时代大学生应当树立的理想信念，其核心是（　）', opts: ['中国特色社会主义共同理想', '个人生活理想', '职业理想', '道德理想'], ans: 0, explain: '在中国共产党领导下，走中国特色社会主义道路、实现中华民族伟大复兴是新时代大学生的理想信念核心。', type: 'single' },
      { id: 'kyzz15', kp: '思想道德修养', diff: 2, q: '道德发挥作用的根本方式依靠（　）', opts: ['内心信念、社会舆论和传统习俗', '国家强制力', '法律制裁', '行政命令'], ans: 0, explain: '道德通过社会舆论、传统习俗和人们的内心信念来维系，不具有国家强制力。', type: 'single' },
      { id: 'kyzz16', kp: '中国近现代史纲要', diff: 3, q: '抗日战争中，中国共产党确定抗日民族统一战线策略方针的会议是（　）', opts: ['瓦窑堡会议', '八七会议', '遵义会议', '洛川会议'], ans: 0, explain: '瓦窑堡会议确定了建立抗日民族统一战线的策略方针。', type: 'single' },
    ]
  },
  {
    id: 'kyyy',
    name: '考研英语',
    desc: '词汇·语法·阅读·翻译',
    color: '#688DDF',
    icon: 'practice',
    kps: ['词汇', '语法与长难句', '阅读理解', '完形填空'],
    questions: [
      { id: 'kyyy1', kp: '词汇', diff: 1, q: 'The scientist was awarded for his outstanding ________ to the field of physics.', opts: ['contributions', 'contradictions', 'complications', 'constructions'], ans: 0, explain: 'contribution 意为"贡献"，make contributions to 为固定搭配。', type: 'single' },
      { id: 'kyyy2', kp: '词汇', diff: 2, q: 'It is essential that every student ________ the opportunity to learn a foreign language.', opts: ['be given', 'is given', 'will be given', 'has been given'], ans: 0, explain: 'essential 后的 that 从句用虚拟语气，谓语为 should + 动词原形，should 可省略。', type: 'single' },
      { id: 'kyyy3', kp: '语法与长难句', diff: 2, q: '________ we have finished the project, we can take a short break.', opts: ['Now that', 'Even if', 'As long as', 'In case'], ans: 0, explain: 'now that 表示"既然"，引导原因状语从句。', type: 'single' },
      { id: 'kyyy4', kp: '词汇', diff: 1, q: 'The word "abandon" most nearly means ________.', opts: ['give up', 'keep', 'accept', 'improve'], ans: 0, explain: 'abandon 意为"放弃、抛弃"，与 give up 同义。', type: 'single' },
      { id: 'kyyy5', kp: '语法与长难句', diff: 3, q: 'The book, ________ cover is red, belongs to my sister.', opts: ['whose', 'which', 'that', 'of which'], ans: 0, explain: '定语从句中 cover 与先行词 the book 是所有关系，用 whose 作定语。', type: 'single' },
      { id: 'kyyy6', kp: '阅读理解', diff: 2, q: 'According to the passage, the main purpose of the study was to ________.', opts: ['examine the effects of sleep on memory', 'compare different learning methods', 'measure the speed of reading', 'test the intelligence of students'], ans: 0, explain: '文章主旨题，需抓住首段主题句，本主题为睡眠对记忆的影响。', type: 'single' },
      { id: 'kyyy7', kp: '阅读理解', diff: 2, q: 'The word "crucial" in the passage is closest in meaning to ________.', opts: ['essential', 'optional', 'harmful', 'unclear'], ans: 0, explain: 'crucial 意为"至关重要的"，同义词为 essential。', type: 'single' },
      { id: 'kyyy8', kp: '完形填空', diff: 2, q: 'He was deeply ________ by the kindness of the strangers who helped him.', opts: ['touched', 'touched to', 'touching', 'being touched'], ans: 0, explain: 'be touched by 意为"被…感动"。', type: 'single' },
      { id: 'kyyy9', kp: '词汇', diff: 2, q: 'The company decided to ________ the plan due to lack of funds.', opts: ['abandon', 'abolish', 'accomplish', 'adopt'], ans: 0, explain: 'abandon 意为"放弃"，符合因资金短缺放弃计划的语境。', type: 'single' },
      { id: 'kyyy10', kp: '语法与长难句', diff: 2, q: 'Hardly had he arrived home ________ it began to rain.', opts: ['when', 'than', 'while', 'then'], ans: 0, explain: 'hardly...when 为固定结构，意为"一…就…"，hardly 置于句首时句子部分倒装。', type: 'single' },
      { id: 'kyyy11', kp: '阅读理解', diff: 3, q: 'Which of the following can be inferred from the last paragraph?', opts: ['The author holds a cautious attitude toward the new policy.', 'The policy has been fully implemented nationwide.', 'Most people strongly oppose the policy.', 'The policy will be cancelled next year.'], ans: 0, explain: '推断题需基于原文证据，"cautious attitude"由文末的保留态度用词推出。', type: 'single' },
      { id: 'kyyy12', kp: '词汇', diff: 1, q: 'The synonym of "frequently" is ________.', opts: ['often', 'seldom', 'never', 'hardly'], ans: 0, explain: 'frequently 意为"频繁地"，与 often 同义。', type: 'single' },
      { id: 'kyyy13', kp: '语法与长难句', diff: 2, q: 'Not only ________ the exam, but he also got the highest score.', opts: ['did he pass', 'he passed', 'he did pass', 'passes he'], ans: 0, explain: 'not only 置于句首引导部分倒装，助动词提前。', type: 'single' },
      { id: 'kyyy14', kp: '完形填空', diff: 2, q: 'She kept silent at the meeting, ________ to express her true opinion.', opts: ['reluctant', 'reluctance', 'reluctantly', 'be reluctant'], ans: 0, explain: '此处需要形容词作伴随状语，reluctant 意为"不情愿的"。', type: 'single' },
      { id: 'kyyy15', kp: '阅读理解', diff: 3, q: 'The author mentions the example in Paragraph 2 mainly to ________.', opts: ['illustrate a previous argument', 'introduce a new topic', 'show a personal experience', 'criticize a common practice'], ans: 0, explain: '举例目的题：例子用来支撑或说明前文的论点。', type: 'single' },
    ]
  },
  {
    id: 'xc',
    name: '公务员行测',
    desc: '言语·判断·数量·资料',
    color: '#6371C8',
    icon: 'target',
    kps: ['言语理解与表达', '判断推理', '数量关系', '常识判断'],
    questions: [
      { id: 'xc1', kp: '言语理解与表达', diff: 1, q: '依次填入下列横线处的词语，最恰当的一组是：\n面对突如其来的困难，他表现得十分____，最终____地解决了问题。', opts: ['沉着/巧妙', '冷静/慌忙', '慌乱/巧妙', '坚定/草率'], ans: 0, explain: '第一空与"困难"搭配应为正面状态，第二空"巧妙"符合最终解决的语境。', type: 'single' },
      { id: 'xc2', kp: '判断推理', diff: 2, q: '如果所有的猫都怕水，有些猫是橘猫，那么可以推出：', opts: ['有些橘猫怕水', '所有的橘猫不怕水', '有些橘猫不怕水', '没有橘猫怕水'], ans: 0, explain: '所有猫怕水 + 有些猫是橘猫，可推出"有些橘猫怕水"。', type: 'single' },
      { id: 'xc3', kp: '数量关系', diff: 2, q: '一项工程，甲单独做需要10天，乙单独做需要15天，两人合作需要多少天完成？', opts: ['6天', '8天', '7天', '5天'], ans: 0, explain: '合作效率=1/10+1/15=1/6，所以需要 6 天。', type: 'single' },
      { id: 'xc4', kp: '常识判断', diff: 1, q: '我国现行宪法规定，国家的根本任务是（　）', opts: ['沿着中国特色社会主义道路，集中力量进行社会主义现代化建设', '实现共产主义', '全面建成小康社会', '实现祖国统一'], ans: 0, explain: '宪法序言规定国家根本任务，即沿着中国特色社会主义道路集中力量进行社会主义现代化建设。', type: 'single' },
      { id: 'xc5', kp: '言语理解与表达', diff: 2, q: '下列句子中没有语病的一项是（　）', opts: ['经过大家的努力，使问题得到了解决。', '这次活动，极大地提高了同学们的团队意识。', '为了避免不再发生类似事故，公司加强了安全管理。', '他的成绩之所以优秀，是因为他勤奋学习的原因。'], ans: 1, explain: 'A"经过…使…"缺主语；C"避免不再发生"否定失当；D"是因为…的原因"句式杂糅。B 无语病。', type: 'single' },
      { id: 'xc6', kp: '判断推理', diff: 2, q: '所有勤奋的人都会成功，张华很勤奋，所以（　）', opts: ['张华会成功', '张华不会成功', '张华可能成功也可能失败', '无法判断'], ans: 0, explain: '三段论：所有 M 都是 P，张华是 M，所以张华是 P。', type: 'single' },
      { id: 'xc7', kp: '数量关系', diff: 3, q: '甲、乙两地相距120千米，一辆汽车从甲地到乙地每小时行60千米，返回时每小时行40千米，往返平均速度是每小时多少千米？', opts: ['48千米', '50千米', '52千米', '45千米'], ans: 0, explain: '往返总路程240千米，总时间=120/60+120/40=5小时，平均速度=240/5=48千米/时。', type: 'single' },
      { id: 'xc8', kp: '常识判断', diff: 2, q: '我国现行宪法是（　）年颁布实施的。', opts: ['1982', '1954', '1978', '1975'], ans: 0, explain: '1982年宪法是现行宪法，历经多次修正。', type: 'single' },
      { id: 'xc9', kp: '判断推理', diff: 2, q: '"并非所有的鸟都会飞"等价于（　）', opts: ['有些鸟不会飞', '所有的鸟都不会飞', '有些鸟会飞', '所有的鸟都会飞'], ans: 0, explain: '"并非所有S都是P"等价于"有些S不是P"。', type: 'single' },
      { id: 'xc10', kp: '言语理解与表达', diff: 2, q: '下列成语使用恰当的一项是（　）', opts: ['他做事总是首鼠两端，很快就定下了方案。', '在这次比赛中，他技压群雄，独领风骚。', '对敌人的进攻，我军按兵不动，立即还击。', '听到这个消息，他喜出望外，闷闷不乐。'], ans: 1, explain: '"首鼠两端"指犹豫不决与"很快定下"矛盾；"按兵不动"指不行动与"立即还击"矛盾；"喜出望外"与"闷闷不乐"矛盾。B 恰当。', type: 'single' },
      { id: 'xc11', kp: '数量关系', diff: 2, q: '某商品原价200元，先降价10%，再提价10%，现价与原价相比（　）', opts: ['减少了2元', '增加了2元', '不变', '减少了4元'], ans: 0, explain: '200×0.9×1.1=198元，比原价减少2元。', type: 'single' },
      { id: 'xc12', kp: '常识判断', diff: 2, q: '中国古代四大发明不包括（　）', opts: ['地动仪', '造纸术', '印刷术', '指南针'], ans: 0, explain: '四大发明为造纸术、印刷术、火药、指南针，地动仪不在其中。', type: 'single' },
      { id: 'xc13', kp: '判断推理', diff: 3, q: '甲、乙、丙三人中只有一人会开车。甲说"我不会开车"，乙说"丙会开车"，丙说"乙会开车"。已知三人中只有一人说真话，则会开车的是（　）', opts: ['甲', '乙', '丙', '无法确定'], ans: 0, explain: '假设甲会开车，则甲假、乙假、丙假，符合"只有一人说真话"？再验证：甲会开车时甲说"我不会"为假，乙说"丙会"为假，丙说"乙会"为假，全假不符。假设乙会开车：甲真、乙假、丙真，两真不符。假设丙会开车：甲真、乙真、丙假，两真不符。故无人满足时重新推：甲说真话即甲不会，且乙、丙都假，即丙不会、乙不会，矛盾无人会开车。综合题干唯一真：设甲真→甲不会且丙不会、乙不会→无人会，与"只有一人会"矛盾。所以甲必假→甲会开车，验证乙假、丙假，满足条件。答案甲。', type: 'single' },
      { id: 'xc14', kp: '言语理解与表达', diff: 1, q: '下列词语中，加点字读音完全正确的一组是（　）', opts: ['哺育(bǔ)、粗犷(guǎng)', '拘泥(ní)、参差(cān)', '唾沫(tǔ)、纤细(qiān)', '模样(mó)、应届(yìng)'], ans: 0, explain: '拘泥(nì)、参差(cēn)、唾(tuò)、纤(xiān)、模(mú)、应(yīng)。A 正确。', type: 'single' },
      { id: 'xc15', kp: '数量关系', diff: 2, q: '一个等差数列的首项为3，公差为4，则其第10项为（　）', opts: ['39', '35', '43', '47'], ans: 0, explain: 'an=a1+(n-1)d=3+9×4=39。', type: 'single' },
    ]
  },
  {
    id: 'sl',
    name: '申论',
    desc: '归纳概括·综合分析·公文写作',
    color: '#E8B54D',
    icon: 'exam',
    kps: ['归纳概括', '综合分析', '提出对策', '公文写作'],
    questions: [
      { id: 'sl1', kp: '归纳概括', diff: 2, q: '申论归纳概括题的核心要求是（　）', opts: ['准确、全面、条理清晰', '语言华丽', '内容越多越好', '必须引用原文'], ans: 0, explain: '归纳概括题要求准确提炼要点、全面覆盖、条理清晰，并非堆砌内容。', type: 'single' },
      { id: 'sl2', kp: '综合分析', diff: 2, q: '"给定资料中‘放管服’改革的核心内涵是（　）"——此类题型属于（　）', opts: ['综合分析题', '归纳概括题', '应用文写作题', '文章写作题'], ans: 0, explain: '对特定概念内涵的解读属于综合分析题的典型问法。', type: 'single' },
      { id: 'sl3', kp: '提出对策', diff: 2, q: '针对资料中反映的基层治理人手不足问题，下列对策最有效的是（　）', opts: ['完善基层干部激励机制，充实基层力量', '减少基层事务', '提高工作标准', '加强舆论宣传'], ans: 0, explain: '解决人手不足需从队伍建设与激励入手，其他选项针对性不足。', type: 'single' },
      { id: 'sl4', kp: '公文写作', diff: 2, q: '公文标题的基本结构是（　）', opts: ['发文机关+事由+文种', '事由+文种', '发文机关+文种', '只写文种'], ans: 0, explain: '公文标题一般由发文机关名称、事由和文种三要素构成。', type: 'single' },
      { id: 'sl5', kp: '归纳概括', diff: 2, q: '作答归纳概括题时，"全面"指的是（　）', opts: ['要点覆盖完整，不遗漏', '字数越多越好', '每个要点都要展开', '面面俱到不分主次'], ans: 0, explain: '全面指采分要点覆盖完整，避免遗漏，而非机械堆字数。', type: 'single' },
      { id: 'sl6', kp: '综合分析', diff: 3, q: '"谈谈你对‘基层减负’的认识"属于（　）', opts: ['评价型综合分析', '解释型综合分析', '关系型综合分析', '启示型综合分析'], ans: 1, explain: '"谈谈认识/看法"是对特定观点、政策的解释评价，属解释型综合分析。', type: 'single' },
      { id: 'sl7', kp: '公文写作', diff: 2, q: '通知这类文种最常用于（　）', opts: ['发布、传达要求下级执行的事项', '向上级汇报工作', '向下级征询意见', '答复下级请示'], ans: 0, explain: '通知用于发布、传达要求下级机关执行和有关单位周知或执行的事项。', type: 'single' },
      { id: 'sl8', kp: '提出对策', diff: 3, q: '对策题作答中"可行性"要求主要指（　）', opts: ['符合法律法规和客观条件，可操作', '语言规范', '对策新颖', '内容详实'], ans: 0, explain: '对策须符合法律政策、技术资金等客观条件，具备可操作性。', type: 'single' },
      { id: 'sl9', kp: '归纳概括', diff: 3, q: '概括题作答常见的错误是（　）', opts: ['简单罗列材料原句，未提炼', '分条作答', '控制字数', '使用规范书面语'], ans: 0, explain: '概括需对材料信息提炼加工，直接抄录原句属于常见失分点。', type: 'single' },
      { id: 'sl10', kp: '公文写作', diff: 2, q: '函适用于（　）', opts: ['不相隶属机关之间商洽工作、询问和答复问题', '向下级布置任务', '向上级汇报工作', '任免干部'], ans: 0, explain: '函用于不相隶属机关之间商洽工作、询问和答复问题等。', type: 'single' },
      { id: 'sl11', kp: '综合分析', diff: 2, q: '综合分析题作答的总体结构通常是（　）', opts: ['总—分—总', '分—总', '总—分', '并列式'], ans: 0, explain: '综合分析题通常先提出观点，再分析论证，最后总结对策或启示，呈总分总结构。', type: 'single' },
    ]
  },
  {
    id: 'sx',
    name: '大学数学',
    desc: '高数·线代·概率论',
    color: '#10B981',
    icon: 'chart',
    kps: ['高等数学', '线性代数', '概率论与数理统计'],
    questions: [
      { id: 'sx1', kp: '高等数学', diff: 1, q: '函数 f(x)=x² 在 x=2 处的导数为（　）', opts: ['4', '2', '8', '0'], ans: 0, explain: 'f\'(x)=2x，f\'(2)=4。', type: 'single' },
      { id: 'sx2', kp: '高等数学', diff: 2, q: 'lim(x→0) sinx/x = （　）', opts: ['1', '0', '∞', '不存在'], ans: 0, explain: '这是重要极限之一，sinx/x 在 x→0 时极限为 1。', type: 'single' },
      { id: 'sx3', kp: '线性代数', diff: 2, q: '行列式 |1 2; 3 4| = （　）', opts: ['-2', '2', '10', '-10'], ans: 0, explain: '二阶行列式 = 1×4 - 2×3 = -2。', type: 'single' },
      { id: 'sx4', kp: '概率论与数理统计', diff: 1, q: '掷一枚均匀骰子，出现偶数点的概率是（　）', opts: ['1/2', '1/3', '1/6', '2/3'], ans: 0, explain: '偶数点有2、4、6共3种，总6种，概率=3/6=1/2。', type: 'single' },
      { id: 'sx5', kp: '高等数学', diff: 2, q: '函数 f(x)=x³-3x 的极小值点为（　）', opts: ['x=1', 'x=-1', 'x=0', 'x=3'], ans: 0, explain: 'f\'(x)=3x²-3=0 得 x=±1；f\'\'(x)=6x，f\'\'(1)=6>0，故 x=1 为极小值点。', type: 'single' },
      { id: 'sx6', kp: '高等数学', diff: 2, q: '∫0¹ x² dx = （　）', opts: ['1/3', '1/2', '1', '2/3'], ans: 0, explain: '∫x²dx=x³/3，代入上下限得 1/3。', type: 'single' },
      { id: 'sx7', kp: '线性代数', diff: 3, q: '设矩阵 A 可逆，则 A⁻¹ 的行列式 |A⁻¹| = （　）', opts: ['1/|A|', '|A|', '-|A|', '1'], ans: 0, explain: '由 |A||A⁻¹|=|E|=1 得 |A⁻¹|=1/|A|。', type: 'single' },
      { id: 'sx8', kp: '概率论与数理统计', diff: 2, q: '若随机变量 X 服从参数为 λ 的泊松分布，则 E(X) = （　）', opts: ['λ', 'λ²', '1/λ', '√λ'], ans: 0, explain: '泊松分布的数学期望等于参数 λ。', type: 'single' },
      { id: 'sx9', kp: '高等数学', diff: 3, q: '曲线 y=lnx 在 x=1 处的切线斜率为（　）', opts: ['1', '0', '-1', '∞'], ans: 0, explain: 'y\'=1/x，在 x=1 处斜率为 1。', type: 'single' },
      { id: 'sx10', kp: '线性代数', diff: 2, q: 'n 阶单位矩阵的秩为（　）', opts: ['n', '1', '0', 'n-1'], ans: 0, explain: '单位矩阵是满秩矩阵，秩等于阶数 n。', type: 'single' },
      { id: 'sx11', kp: '概率论与数理统计', diff: 2, q: '相互独立事件 A、B 同时发生的概率等于（　）', opts: ['P(A)×P(B)', 'P(A)+P(B)', 'P(A)÷P(B)', 'max(P(A),P(B))'], ans: 0, explain: '独立事件同时发生概率为两者概率之积。', type: 'single' },
      { id: 'sx12', kp: '高等数学', diff: 2, q: '函数 f(x)=eˣ 的 n 阶导数为（　）', opts: ['eˣ', 'neˣ', 'n!eˣ', '0'], ans: 0, explain: 'eˣ 的任意阶导数都是 eˣ 本身。', type: 'single' },
      { id: 'sx13', kp: '线性代数', diff: 3, q: '向量组 α₁=(1,0,0)，α₂=(0,1,0)，α₃=(0,0,1) 线性（　）', opts: ['无关', '相关', '无法判断', '部分相关'], ans: 0, explain: '三个标准单位向量构成单位矩阵，线性无关。', type: 'single' },
      { id: 'sx14', kp: '概率论与数理统计', diff: 3, q: '正态分布 N(μ,σ²) 的标准差为（　）', opts: ['σ', 'σ²', '√σ', 'μ'], ans: 0, explain: 'N(μ,σ²) 中 σ² 为方差，σ 为标准差。', type: 'single' },
    ]
  },
  {
    id: 'cet',
    name: '大学英语四六级',
    desc: '词汇·阅读·听力·翻译',
    color: '#EE9B62',
    icon: 'medal',
    kps: ['词汇', '阅读理解', '语法', '翻译'],
    questions: [
      { id: 'cet1', kp: '词汇', diff: 1, q: 'The hotel is well known for its excellent ________.', opts: ['service', 'servant', 'served', 'serving'], ans: 0, explain: '此处需要名词 service，意为"服务"。', type: 'single' },
      { id: 'cet2', kp: '词汇', diff: 2, q: 'He ________ his success to hard work and good luck.', opts: ['attributes', 'contributes', 'distributes', 'substitutes'], ans: 0, explain: 'attribute...to... 意为"把…归因于…"。', type: 'single' },
      { id: 'cet3', kp: '阅读理解', diff: 2, q: 'According to the passage, online learning is ________ traditional classroom learning.', opts: ['as effective as', 'less effective than', 'more effective than', 'not comparable to'], ans: 0, explain: '细节题，根据原文比较句判断两者效果相当。', type: 'single' },
      { id: 'cet4', kp: '词汇', diff: 2, q: 'The ________ of the new policy remains to be seen.', opts: ['effect', 'affect', 'effort', 'affair'], ans: 0, explain: 'effect 名词"影响、效果"，此处需要名词。', type: 'single' },
      { id: 'cet5', kp: '语法', diff: 2, q: 'If I ________ you, I would accept the offer.', opts: ['were', 'am', 'was', 'be'], ans: 0, explain: '虚拟语气中 be 动词一律用 were。', type: 'single' },
      { id: 'cet6', kp: '翻译', diff: 2, q: '"一带一路"的英文表达是（　）', opts: ['the Belt and Road Initiative', 'One Belt One Road Project', 'the Road and Belt Plan', 'Silk Road Initiative'], ans: 0, explain: '官方英文表述为 the Belt and Road Initiative（BRI）。', type: 'single' },
      { id: 'cet7', kp: '词汇', diff: 1, q: 'The opposite of "increase" is ________.', opts: ['decrease', 'invent', 'inject', 'indicate'], ans: 0, explain: 'increase 的反义词为 decrease"减少"。', type: 'single' },
      { id: 'cet8', kp: '阅读理解', diff: 3, q: 'The word "sustainable" in the passage most likely means ________.', opts: ['able to continue over time', 'extremely profitable', 'environmentally friendly only', 'widely supported'], ans: 0, explain: 'sustainable 意为"可持续的"，即能够长期延续。', type: 'single' },
      { id: 'cet9', kp: '语法', diff: 2, q: '________ from the top of the hill, the city looks magnificent.', opts: ['Seen', 'Seeing', 'To see', 'Having seen'], ans: 0, explain: '主语 the city 与 see 为被动关系，用过去分词 seen 作状语。', type: 'single' },
      { id: 'cet10', kp: '翻译', diff: 3, q: '"民以食为天"的最佳英文翻译是（　）', opts: ['Food is the first necessity of the people.', 'People take food as heaven.', 'The people use food as the sky.', 'Food and sky are both important.'], ans: 0, explain: '意译"食物是人民的第一需要"更符合英文表达习惯。', type: 'single' },
      { id: 'cet11', kp: '词汇', diff: 2, q: 'We must take measures to ________ the environment.', opts: ['protect', 'project', 'protest', 'proceed'], ans: 0, explain: 'protect the environment 意为"保护环境"。', type: 'single' },
      { id: 'cet12', kp: '阅读理解', diff: 3, q: 'Which statement best summarizes the main idea of the passage?', opts: ['Technology is transforming the way people learn.', 'People should avoid using technology.', 'Schools are closing down.', 'Traditional methods are obsolete.'], ans: 0, explain: '主旨题，需概括全文核心观点：技术正在改变学习方式。', type: 'single' },
      { id: 'cet13', kp: '语法', diff: 2, q: 'By the end of last month, he ________ in this company for ten years.', opts: ['had worked', 'has worked', 'worked', 'works'], ans: 0, explain: 'by + 过去时间，主句用过去完成时 had worked。', type: 'single' },
      { id: 'cet14', kp: '词汇', diff: 2, q: 'The meeting was ________ because of the bad weather.', opts: ['cancelled', 'candid', 'cautious', 'capable'], ans: 0, explain: 'cancelled 意为"被取消"，符合因恶劣天气取消会议的语境。', type: 'single' },
    ]
  }
];

/* 模拟考试卷配置 */
const EXAM_PAPERS = [
  { id: 'paper-kyzz', bank: 'kyzz', name: '考研政治模拟卷（一）', minutes: 30, diff: '中', desc: '覆盖马原、毛中特、史纲、思修核心考点' },
  { id: 'paper-xc', bank: 'xc', name: '行测模拟卷（一）', minutes: 20, diff: '中', desc: '言语、判断、数量、常识全题型演练' },
  { id: 'paper-sx', bank: 'sx', name: '大学数学模拟卷（一）', minutes: 30, diff: '较难', desc: '高数、线代、概率核心题型综合' },
];

/* 训练模式配置 */
const TRAIN_MODES = [
  { id: 'random', name: '随机刷题', desc: '随机抽取题目，不限次数', icon: 'refresh', color: '#688DDF', free: true },
  { id: 'bykp', name: '知识点专项', desc: '按知识点强化训练', icon: 'target', color: '#6371C8', free: true },
  { id: 'wrong', name: '错题重练', desc: '针对错题本反复巩固', icon: 'wrong', color: '#EF4444', free: true },
  { id: 'speed', name: '限时冲刺', desc: '限定时间高强度训练', icon: 'clock', color: '#E8B54D', free: false, vip: 'vip1' },
];

/* VIP 等级配置 */
const VIP_PLANS = [
  {
    id: 'free', name: '普通用户', price: 0, tag: '免费',
    color: '#64748B', icon: 'user',
    desc: '基础学习体验',
    features: [
      { text: '全部科目题库自由刷题', on: true },
      { text: '每日 50 题刷题额度', on: true },
      { text: '错题本收录（上限100题）', on: true },
      { text: '模拟考试', on: false },
      { text: '知识点专项训练', on: false },
      { text: '限时冲刺训练', on: false },
      { text: '智能解析 / 学习报告', on: false },
      { text: 'AI 错题讲解', on: false },
    ]
  },
  {
    id: 'vip1', name: '黄金VIP', price: 18, tag: '月卡', popular: false,
    color: '#E8B54D', icon: 'vip',
    desc: '适合日常刷题，解锁核心训练',
    features: [
      { text: '不限量刷题，无次数限制', on: true },
      { text: '错题本无限收录', on: true },
      { text: '限时冲刺训练', on: true },
      { text: '模拟考试（每月3次）', on: true },
      { text: '知识点专项训练', on: true },
      { text: '智能解析 / 学习报告', on: false },
      { text: 'AI 错题讲解', on: false },
      { text: '专属客服', on: false },
    ]
  },
  {
    id: 'vip2', name: '铂金VIP', price: 45, tag: '季卡', popular: true,
    color: '#94A3B8', icon: 'vip',
    desc: '深度备考推荐，提分利器',
    features: [
      { text: '不限量刷题，无次数限制', on: true },
      { text: '错题本无限收录', on: true },
      { text: '限时冲刺训练', on: true },
      { text: '模拟考试不限次数', on: true },
      { text: '知识点专项训练', on: true },
      { text: '智能解析 / 学习报告', on: true },
      { text: 'AI 错题讲解', on: true },
      { text: '专属客服', on: true },
    ]
  },
  {
    id: 'vip3', name: '钻石VIP', price: 158, tag: '年卡', popular: false,
    color: '#38BDF8', icon: 'medal',
    desc: '全年备考全解锁，至尊权益',
    features: [
      { text: '不限量刷题，无次数限制', on: true },
      { text: '错题本无限收录', on: true },
      { text: '限时冲刺训练', on: true },
      { text: '模拟考试不限次数', on: true },
      { text: '知识点专项训练', on: true },
      { text: '智能解析 / 学习报告', on: true },
      { text: 'AI 错题讲解（不限次数）', on: true },
      { text: '专属客服 / 新功能优先体验', on: true },
    ]
  }
];

/* 辅助函数 */
/* 个人题库（存储于 Store，按用户隔离）；运行时 Store 已就绪（全局 const，不挂 window） */
function personalBanks() {
  try { return (typeof Store !== 'undefined' && typeof Store.getPersonalBanks === 'function') ? Store.getPersonalBanks() : []; }
  catch (e) { return []; }
}
function bankById(id) {
  const b = QUESTION_BANKS.find(b => b.id === id);
  if (b) return b;
  return personalBanks().find(b => b.id === id) || null;
}
function questionById(id) {
  for (const b of QUESTION_BANKS) {
    const q = b.questions.find(q => q.id === id);
    if (q) return q;
  }
  for (const b of personalBanks()) {
    const q = b.questions.find(q => q.id === id);
    if (q) return { ...q, bank: b.id };
  }
  return null;
}
function allQuestions() {
  const list = [];
  QUESTION_BANKS.forEach(b => b.questions.forEach(q => list.push({ ...q, bank: b.id, bankName: b.name })));
  personalBanks().forEach(b => b.questions.forEach(q => list.push({ ...q, bank: b.id, bankName: b.name })));
  return list;
}
function diffLabel(d) { return ['简单', '中等', '较难'][d - 1] || '中等'; }
function optsLabel(i) { return 'ABCDEFGH'[i]; }
