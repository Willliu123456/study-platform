/* ============ 学升题库扩充（第2批）考研政治 + 考研英语 ============ */
/* 结构同 data.js：在页面加载后把新题追加到 QUESTION_BANKS 对应科目中 */
(function () {
  const EXTRA = {
    kyzz: [
      { id: 'kyzz17', kp: '马克思主义基本原理', diff: 1, q: '意识的本质是（　）', opts: ['人脑的机能和对客观世界的主观映像', '大脑分泌的特殊物质', '独立于物质的实体', '神灵赋予的智慧'], ans: 0, explain: '意识是人脑的机能，是客观世界的主观映像，内容客观、形式主观。', type: 'single' },
      { id: 'kyzz18', kp: '马克思主义基本原理', diff: 2, q: '下列属于实践基本形式的是（　）', opts: ['生产劳动', '闭门思过', '观看比赛', '白日做梦'], ans: 0, explain: '实践的基本形式有生产实践、处理社会关系的实践和科学实验，生产劳动是基本形式。', type: 'single' },
      { id: 'kyzz19', kp: '马克思主义基本原理', diff: 2, q: '认识过程的第一次飞跃是（　）', opts: ['由感性认识到理性认识', '由理性认识到实践', '由实践到感性认识', '由理性认识到感性认识'], ans: 0, explain: '认识过程中的第一次飞跃是从感性认识上升到理性认识，第二次飞跃是理性认识回到实践。', type: 'single' },
      { id: 'kyzz20', kp: '马克思主义基本原理', diff: 3, q: '社会存在与社会意识的关系问题是（　）', opts: ['历史观的基本问题', '认识论的基本问题', '唯物论的基本问题', '辩证法的基本问题'], ans: 0, explain: '社会存在与社会意识的关系问题是划分历史唯物主义与历史唯心主义的根本标准，是历史观的基本问题。', type: 'single' },
      { id: 'kyzz21', kp: '马克思主义基本原理', diff: 2, q: '质量互变规律揭示了事物发展的（　）', opts: ['形式和状态', '方向和道路', '源泉和动力', '原因和结果'], ans: 0, explain: '质量互变规律揭示事物发展的形式和状态，对立统一规律揭示源泉和动力。', type: 'single' },
      { id: 'kyzz22', kp: '毛泽东思想和中国特色社会主义理论', diff: 2, q: '我国的根本政治制度是（　）', opts: ['人民代表大会制度', '政治协商制度', '民族区域自治制度', '基层群众自治制度'], ans: 0, explain: '人民代表大会制度是我国的根本政治制度，其余为基本政治制度。', type: 'single' },
      { id: 'kyzz23', kp: '毛泽东思想和中国特色社会主义理论', diff: 2, q: '中国特色社会主义最本质的特征是（　）', opts: ['中国共产党领导', '人民当家作主', '依法治国', '改革开放'], ans: 0, explain: '中国特色社会主义最本质的特征是中国共产党领导，也是最大的制度优势。', type: 'single' },
      { id: 'kyzz24', kp: '毛泽东思想和中国特色社会主义理论', diff: 3, q: '新发展理念中，解决发展动力问题的是（　）', opts: ['创新', '协调', '绿色', '开放'], ans: 0, explain: '创新是引领发展的第一动力，解决发展动力问题；协调解决不平衡，绿色解决人与自然和谐问题。', type: 'single' },
      { id: 'kyzz25', kp: '中国近现代史纲要', diff: 2, q: '太平天国运动失败的根源在于（　）', opts: ['农民阶级的局限性', '缺乏军事人才', '清政府力量强大', '外国列强干涉'], ans: 0, explain: '农民阶级的阶级局限性是太平天国运动失败的根本原因。', type: 'single' },
      { id: 'kyzz26', kp: '中国近现代史纲要', diff: 2, q: '新文化运动兴起的标志是（　）', opts: ['《青年杂志》创刊', '五四运动爆发', '十月革命胜利', '《新青年》移北京'], ans: 0, explain: '1915年陈独秀创办《青年杂志》（后改名《新青年》），标志新文化运动兴起。', type: 'single' },
      { id: 'kyzz27', kp: '中国近现代史纲要', diff: 3, q: '标志着中国新民主主义革命基本胜利的事件是（　）', opts: ['中华人民共和国的成立', '抗日战争胜利', '三大战役结束', '土地改革完成'], ans: 0, explain: '1949年新中国成立标志着新民主主义革命取得基本胜利。', type: 'single' },
      { id: 'kyzz28', kp: '思想道德修养', diff: 1, q: '个人理想与社会理想的关系是（　）', opts: ['社会理想是个人理想的汇聚和升华', '个人理想高于社会理想', '两者毫无关系', '社会理想压制个人理想'], ans: 0, explain: '社会理想建立在广大个人理想基础上，是个人理想的汇聚和升华。', type: 'single' },
      { id: 'kyzz29', kp: '思想道德修养', diff: 2, q: '人生观的核心是（　）', opts: ['人生目的', '人生态度', '人生价值', '人生道路'], ans: 0, explain: '人生目的是人生观的核心，决定人生态度和人生价值。', type: 'single' },
      { id: 'kyzz30', kp: '马克思主义基本原理', diff: 3, q: '剩余价值产生的源泉是（　）', opts: ['雇佣工人的剩余劳动', '先进的技术设备', '资本的循环周转', '流通领域的差价'], ans: 0, explain: '剩余价值是雇佣工人在剩余劳动时间内创造的、被资本家无偿占有的价值。', type: 'single' },
      { id: 'kyzz31', kp: '马克思主义基本原理', diff: 2, q: '商品二因素是指（　）', opts: ['使用价值和价值', '交换价值和价格', '价值和使用价值中抽象劳动与具体劳动', '价格与供求'], ans: 0, explain: '商品是使用价值和价值的统一体，二因素即使用价值与价值。', type: 'single' },
      { id: 'kyzz32', kp: '毛泽东思想和中国特色社会主义理论', diff: 1, q: '我国的国体是（　）', opts: ['人民民主专政', '人民代表大会制度', '民族区域自治', '多党合作制度'], ans: 0, explain: '国体即国家性质，我国是工人阶级领导的、以工农联盟为基础的人民民主专政的社会主义国家。', type: 'single' },
      { id: 'kyzz33', kp: '中国近现代史纲要', diff: 2, q: '中国共产党第一次全国代表大会召开于（　）', opts: ['1921年7月', '1920年7月', '1922年7月', '1919年5月'], ans: 0, explain: '1921年7月中共一大在上海（后转嘉兴南湖）召开，标志着中国共产党诞生。', type: 'single' },
      { id: 'kyzz34', kp: '思想道德修养', diff: 2, q: '社会主义核心价值观中，属于个人层面的是（　）', opts: ['爱国、敬业、诚信、友善', '富强、民主、文明、和谐', '自由、平等、公正、法治', '创新、协调、绿色、开放'], ans: 0, explain: '个人层面价值准则是爱国、敬业、诚信、友善。', type: 'single' },
      { id: 'kyzz35', kp: '马克思主义基本原理', diff: 2, q: '真理的客观性是指（　）', opts: ['真理的内容是客观的', '真理形式是客观的', '真理主体是客观的', '真理是永恒不变的'], ans: 0, explain: '真理的客观性在于其内容是对客观事物及其规律的正确反映，不依赖于人的意志。', type: 'single' },
      { id: 'kyzz36', kp: '毛泽东思想和中国特色社会主义理论', diff: 3, q: '"一国两制"的前提和基础是（　）', opts: ['一个中国', '高度自治', '和平统一', '两制并存'], ans: 0, explain: '"一国两制"的前提和基础是一个中国，国家主权和领土完整不容分割。', type: 'single' },
      { id: 'kyzz37', kp: '中国近现代史纲要', diff: 2, q: '中国抗日战争全面爆发的标志是（　）', opts: ['卢沟桥事变', '九一八事变', '一二八事变', '西安事变'], ans: 0, explain: '1937年7月7日卢沟桥事变标志全民族抗战爆发。', type: 'single' },
      { id: 'kyzz38', kp: '思想道德修养', diff: 2, q: '法律区别于道德的主要特征是（　）', opts: ['由国家制定或认可并由国家强制力保证实施', '依靠社会舆论维持', '存在于一定阶级社会中', '具有历史继承性'], ans: 0, explain: '法律以国家强制力为实施保障，这是其区别于道德等社会规范的主要特征。', type: 'single' },
      { id: 'kyzz39', kp: '马克思主义基本原理', diff: 3, q: '人类社会发展的根本动力是（　）', opts: ['社会基本矛盾', '人民群众', '科学技术革命', '阶级斗争'], ans: 0, explain: '生产力和生产关系、经济基础和上层建筑的矛盾运动是社会发展的根本动力。', type: 'single' },
      { id: 'kyzz40', kp: '毛泽东思想和中国特色社会主义理论', diff: 2, q: '建设现代化经济体系的战略支撑是（　）', opts: ['创新驱动发展战略', '乡村振兴战略', '区域协调战略', '对外开放战略'], ans: 0, explain: '创新是建设现代化经济体系的战略支撑，要加快建设创新型国家。', type: 'single' },
      { id: 'kyzz41', kp: '中国近现代史纲要', diff: 3, q: '确立毛泽东在党中央实际领导地位的会议是（　）', opts: ['遵义会议', '八七会议', '古田会议', '瓦窑堡会议'], ans: 0, explain: '遵义会议确立了以毛泽东为主要代表的马克思主义正确路线在党中央的领导地位。', type: 'single' },
      { id: 'kyzz42', kp: '思想道德修养', diff: 1, q: '职业道德中，诚实守信属于（　）', opts: ['基本要求', '核心内容', '最高境界', '无关要求'], ans: 0, explain: '爱岗敬业是基础，诚实守信是职业道德的基本要求。', type: 'single' },
      { id: 'kyzz43', kp: '马克思主义基本原理', diff: 2, q: '区分量变和质变的根本标志是（　）', opts: ['是否超出度的范围', '速度的快慢', '规模的大小', '数量的多少'], ans: 0, explain: '区分量变与质变的根本标志是事物的变化是否超出"度"的范围。', type: 'single' },
    ],
    kyyy: [
      { id: 'kyyy16', kp: '词汇', diff: 2, q: 'The professor\'s lecture was so ________ that many students fell asleep.', opts: ['tedious', 'inspiring', 'brilliant', 'absorbing'], ans: 0, explain: 'tedious 意为"乏味的、冗长的"，与后文"学生睡着"语境相符。', type: 'single' },
      { id: 'kyyy17', kp: '语法与长难句', diff: 2, q: 'She is one of the students who ________ praised by the teacher.', opts: ['were', 'was', 'is', 'are'], ans: 0, explain: '定语从句修饰 the students，先行词为复数，故谓语用复数 were。', type: 'single' },
      { id: 'kyyy18', kp: '词汇', diff: 2, q: 'The committee will ________ the proposal at the next meeting.', opts: ['review', 'revive', 'revise the approval of', 'reverse'], ans: 0, explain: 'review 意为"审查、评审"，符合委员会审阅提案的语境。', type: 'single' },
      { id: 'kyyy19', kp: '阅读理解', diff: 2, q: 'The author\'s tone in the passage can best be described as ________.', opts: ['objective', 'ironic', 'indifferent', 'exaggerated'], ans: 0, explain: '作者客观陈述事实与数据，语气为客观中立（objective）。', type: 'single' },
      { id: 'kyyy20', kp: '词汇', diff: 1, q: 'The word "enhance" most nearly means ________.', opts: ['improve', 'reduce', 'replace', 'ignore'], ans: 0, explain: 'enhance 意为"提高、增强"，同义词为 improve。', type: 'single' },
      { id: 'kyyy21', kp: '语法与长难句', diff: 3, q: 'Only after he explained the plan ________ how important it was.', opts: ['did I realize', 'I realized', 'I did realize', 'realized I'], ans: 0, explain: 'only + 状语置于句首时主句部分倒装，助动词提前。', type: 'single' },
      { id: 'kyyy22', kp: '词汇', diff: 2, q: 'The two countries reached an ________ on trade issues.', opts: ['agreement', 'argument', 'arrangement of', 'announcement for'], ans: 0, explain: 'reach an agreement 为固定搭配，意为"达成协议"。', type: 'single' },
      { id: 'kyyy23', kp: '阅读理解', diff: 3, q: 'According to the passage, which of the following is TRUE?', opts: ['The data was collected over a ten-year period.', 'The study involved only college students.', 'The results were published last year.', 'The sample size was smaller than expected.'], ans: 0, explain: '细节判断题须逐项比对原文，只有 A 项与文中"十年间收集数据"一致。', type: 'single' },
      { id: 'kyyy24', kp: '完形填空', diff: 2, q: 'He decided to ________ the challenge despite the risks.', opts: ['take up', 'take off', 'take down', 'take over'], ans: 0, explain: 'take up 意为"接受、开始从事"，take up the challenge 为固定表达。', type: 'single' },
      { id: 'kyyy25', kp: '词汇', diff: 1, q: 'The opposite of "permanent" is ________.', opts: ['temporary', 'terminal', 'partial', 'practical'], ans: 0, explain: 'permanent 意为"永久的"，反义词是 temporary"暂时的"。', type: 'single' },
      { id: 'kyyy26', kp: '语法与长难句', diff: 2, q: '________ the weather, the sports meeting will be held as scheduled.', opts: ['Regardless of', 'In spite', 'Because', 'According'], ans: 0, explain: 'regardless of 意为"不管、不顾"，符合让步逻辑。', type: 'single' },
      { id: 'kyyy27', kp: '阅读理解', diff: 2, q: 'The purpose of the first paragraph is to ________.', opts: ['introduce the topic', 'draw a conclusion', 'give an example', 'present the findings'], ans: 0, explain: '首段通常引出话题，为后文论述作铺垫。', type: 'single' },
      { id: 'kyyy28', kp: '词汇', diff: 2, q: 'The company\'s ________ in the market is declining year by year.', opts: ['share', 'shape', 'shade', 'shame'], ans: 0, explain: 'market share 意为"市场份额"，符合语境。', type: 'single' },
      { id: 'kyyy29', kp: '完形填空', diff: 2, q: '________ he had enough money, he still refused to buy a new car.', opts: ['Although', 'Because', 'Unless', 'Provided'], ans: 0, explain: 'although 引导让步状语从句，意为"尽管"。', type: 'single' },
      { id: 'kyyy30', kp: '词汇', diff: 3, q: 'The word "hinder" in the passage is closest in meaning to ________.', opts: ['impede', 'help', 'ignore', 'accelerate'], ans: 0, explain: 'hinder 意为"阻碍"，与 impede 同义。', type: 'single' },
      { id: 'kyyy31', kp: '语法与长难句', diff: 3, q: 'The number of students ________ in the dormitory is limited.', opts: ['living', 'lived', 'live', 'to be lived'], ans: 0, explain: '现在分词短语 living in the dormitory 作后置定语修饰 students。', type: 'single' },
      { id: 'kyyy32', kp: '阅读理解', diff: 2, q: 'It can be inferred from the passage that the author believes ________.', opts: ['education should focus on practical skills', 'theories are more important than practice', 'students should avoid technology', 'exams are the only measure of ability'], ans: 0, explain: '推断题应基于文中对实践能力的强调，A 项最符合。', type: 'single' },
      { id: 'kyyy33', kp: '词汇', diff: 2, q: 'She was promoted because of her ________ performance.', opts: ['outstanding', 'outdated', 'outgoing to', 'outward'], ans: 0, explain: 'outstanding 意为"杰出的、优秀的"，修饰 performance。', type: 'single' },
      { id: 'kyyy34', kp: '语法与长难句', diff: 2, q: 'By the time you arrive, the meeting ________.', opts: ['will have started', 'has started', 'had started', 'starts'], ans: 0, explain: 'by the time + 一般现在时表将来，主句用将来完成时。', type: 'single' },
      { id: 'kyyy35', kp: '词汇', diff: 2, q: 'The ________ of the disease has caused widespread panic.', opts: ['outbreak', 'outburst', 'outcome', 'outline'], ans: 0, explain: 'outbreak 意为"爆发"，the outbreak of the disease 为疾病爆发。', type: 'single' },
      { id: 'kyyy36', kp: '完形填空', diff: 3, q: 'If he ________ more careful, he would not have made such a mistake.', opts: ['had been', 'has been', 'were', 'would be'], ans: 0, explain: '与过去事实相反的虚拟条件句，从句用 had + 过去分词。', type: 'single' },
      { id: 'kyyy37', kp: '阅读理解', diff: 3, q: 'The author mentions the statistics mainly to ________.', opts: ['support his argument', 'show off his research', 'criticize the government', 'entertain the readers'], ans: 0, explain: '引用数据是为论证观点服务，目的是支撑论点。', type: 'single' },
      { id: 'kyyy38', kp: '词汇', diff: 1, q: 'The synonym of "beneficial" is ________.', opts: ['advantageous', 'disastrous', 'tremendous', 'dangerous'], ans: 0, explain: 'beneficial 意为"有益的"，同义词为 advantageous。', type: 'single' },
      { id: 'kyyy39', kp: '语法与长难句', diff: 3, q: '________ is known to all, the earth is round.', opts: ['As', 'It', 'Which', 'What'], ans: 0, explain: 'as 引导非限制性定语从句，as is known to all 意为"众所周知"。', type: 'single' },
      { id: 'kyyy40', kp: '词汇', diff: 2, q: 'The government has taken measures to ________ unemployment.', opts: ['combat', 'combine', 'commit', 'complain'], ans: 0, explain: 'combat 意为"与…作斗争、遏制"，combat unemployment 为治理失业。', type: 'single' },
      { id: 'kyyy41', kp: '完形填空', diff: 2, q: 'The old man ________ the young couple for their kindness.', opts: ['thanked', 'threatened', 'threw', 'thought'], ans: 0, explain: 'thank sb. for sth. 意为"为某事感谢某人"。', type: 'single' },
      { id: 'kyyy42', kp: '阅读理解', diff: 2, q: 'What is the best title for the passage?', opts: ['The Power of Positive Thinking', 'How to Avoid Failure', 'The History of Psychology', 'Ways to Make Money'], ans: 0, explain: '标题题需概括全文主题，全文围绕积极思维的作用展开，A 最合适。', type: 'single' },
    ]
  };
  for (const b of QUESTION_BANKS) {
    const add = EXTRA[b.id];
    if (add) b.questions.push(...add);
  }
})();
