/* ============ 学升题库扩充（第9批）四六级 part2 + 申论 part3 ============ */
(function () {
  const EXTRA = {
    cet: [
      { id: 'cet29', kp: '词汇', diff: 2, q: 'She is ________ about her future career choices.', opts: ['confident', 'confidential', 'convenient', 'constant'], ans: 0, explain: 'confident 意为"自信的、有把握的"，be confident about 为"对…有信心"。', type: 'single' },
      { id: 'cet30', kp: '语法', diff: 2, q: 'Neither he nor his friends ________ able to solve the problem.', opts: ['were', 'was', 'is', 'has been'], ans: 0, explain: 'neither...nor 就近原则，谓语与最近的主语 friends 一致，用复数 were。', type: 'single' },
      { id: 'cet31', kp: '阅读理解', diff: 2, q: 'The passage suggests that people should ________.', opts: ['balance work and leisure', 'work as hard as possible', 'avoid taking breaks', 'focus only on career'], ans: 0, explain: '文中建议人们平衡工作与休闲，而非一味工作。', type: 'single' },
      { id: 'cet32', kp: '词汇', diff: 2, q: 'The company\'s ________ goal is to become the market leader.', opts: ['ultimate', 'ultimatum', 'ultraviolet', 'ultrasound'], ans: 0, explain: 'ultimate 意为"最终的、根本的"，ultimate goal 为"最终目标"。', type: 'single' },
      { id: 'cet33', kp: '翻译', diff: 3, q: '"脚踏实地"的最佳英文翻译是（　）', opts: ['Down-to-earth', 'Foot on the ground', 'Step on reality', 'Earth under feet'], ans: 0, explain: 'down-to-earth 意为"务实的、脚踏实地的"，是英文常用表达。', type: 'single' },
      { id: 'cet34', kp: '语法', diff: 3, q: 'The reason ________ he was late is that he missed the bus.', opts: ['why', 'which', 'what', 'who'], ans: 0, explain: '定语从句修饰 the reason，关系副词用 why。', type: 'single' },
      { id: 'cet35', kp: '词汇', diff: 2, q: 'Reading widely can ________ your vocabulary.', opts: ['enrich', 'enlarge', 'enable', 'endure'], ans: 0, explain: 'enrich 意为"充实、丰富"，enrich your vocabulary 为"丰富词汇"。', type: 'single' },
      { id: 'cet36', kp: '阅读理解', diff: 3, q: 'The word "challenging" in the passage most likely means ________.', opts: ['demanding', 'easy', 'enjoyable', 'boring'], ans: 0, explain: 'challenging 意为"具有挑战性的"，与 demanding 同义。', type: 'single' },
      { id: 'cet37', kp: '词汇', diff: 1, q: 'The synonym of "huge" is ________.', opts: ['enormous', 'tiny', 'narrow', 'shallow'], ans: 0, explain: 'huge 与 enormous 都表示"巨大的"。', type: 'single' },
      { id: 'cet38', kp: '语法', diff: 2, q: '________ the project is completed, we will start the new one.', opts: ['Once', 'Although', 'Unless', 'While'], ans: 0, explain: 'once 意为"一旦"，表示时间条件关系。', type: 'single' },
      { id: 'cet39', kp: '词汇', diff: 3, q: 'The word "controversial" is closest in meaning to ________.', opts: ['debatable', 'obvious', 'harmless', 'agreeable'], ans: 0, explain: 'controversial 意为"有争议的"，与 debatable 同义。', type: 'single' },
      { id: 'cet40', kp: '阅读理解', diff: 2, q: 'According to the article, the key to success is ________.', opts: ['persistence and effort', 'luck and chance', 'talent only', 'wealth and fame'], ans: 0, explain: '文章强调坚持与努力是成功的关键。', type: 'single' },
      { id: 'cet41', kp: '翻译', diff: 3, q: '"各司其职"的最佳英文翻译是（　）', opts: ['Each does his own job', 'Everyone helps each other', 'All share the same job', 'Nobody does anything'], ans: 0, explain: '各司其职指各人做好分内之事，直译为 Each does his own job。', type: 'single' },
      { id: 'cet42', kp: '语法', diff: 3, q: 'Had I known the truth, I ________ him about it.', opts: ['would have told', 'would tell', 'told', 'had told'], ans: 0, explain: '与过去事实相反的虚拟语气，主句用 would have done。', type: 'single' },
    ],
    sl: [
      { id: 'sl34', kp: '公文写作', diff: 2, q: '公告适用于（　）', opts: ['向国内外宣布重要事项或法定事项', '向下级布置任务', '向上级汇报工作', '答复下级请示'], ans: 0, explain: '公告用于向国内外宣布重要事项或法定事项。', type: 'single' },
      { id: 'sl35', kp: '提出对策', diff: 3, q: '"疏堵结合"治理城市小广告，其中"疏"指的是（　）', opts: ['提供合法张贴渠道', '严厉处罚', '加大巡查', '禁止张贴'], ans: 0, explain: '疏堵结合中"疏"指引导疏通，提供合法规范的发布渠道。', type: 'single' },
      { id: 'sl36', kp: '归纳概括', diff: 3, q: '作答归纳概括题，材料的"矛盾点"通常指（　）', opts: ['政策要求与基层实际之间的差距', '材料中的错别字', '不同数字的差异', '文字的重复'], ans: 0, explain: '申论中的矛盾点多指政策目标与落地现实之间的差距。', type: 'single' },
      { id: 'sl37', kp: '综合分析', diff: 3, q: '"谈谈‘直播带货’兴起的原因及影响"属于（　）', opts: ['原因加影响分析', '解释型分析', '评价型分析', '对策题'], ans: 0, explain: '同时分析原因与影响，属于综合型的现象分析题。', type: 'single' },
      { id: 'sl38', kp: '公文写作', diff: 2, q: '工作计划一般包含的要素是（　）', opts: ['目标、措施、步骤、时间安排', '只有目标', '只有措施', '随意撰写'], ans: 0, explain: '完整的工作计划应包含目标、措施、步骤与时间安排等要素。', type: 'single' },
      { id: 'sl39', kp: '提出对策', diff: 3, q: '针对"大学生就业难"，政府层面的长效对策是（　）', opts: ['完善就业政策、优化人才培养结构', '限制大学扩招', '取消就业市场', '鼓励全部考研'], ans: 0, explain: '从政策引导与人才培养结构优化入手才具长效性。', type: 'single' },
      { id: 'sl40', kp: '归纳概括', diff: 2, q: '申论材料中"启示类"要素主要指（　）', opts: ['从经验教训中总结出的做法', '材料的背景介绍', '文段的过渡句', '人名地名'], ans: 0, explain: '启示类要点是从案例经验教训中提炼出的可借鉴做法。', type: 'single' },
      { id: 'sl41', kp: '公文写作', diff: 3, q: '请示与报告的相同点是（　）', opts: ['都属上行文', '都要求批复', '都必须一文一事', '都只能写给上级'], ans: 0, explain: '请示与报告均属上行文，但报告一般不要求批复。', type: 'single' },
      { id: 'sl42', kp: '综合分析', diff: 3, q: '"请分析‘平台经济’发展的利与弊"属于（　）', opts: ['双面分析题', '解释型分析', '评价型分析', '归纳题'], ans: 0, explain: '要求分析利与弊两个方面，属双面（辩证）分析题。', type: 'single' },
      { id: 'sl43', kp: '提出对策', diff: 2, q: '基层治理中"网格化管理"的优势在于（　）', opts: ['责任到人、精细服务', '增加人员编制', '减少群众参与', '简化工作流程'], ans: 0, explain: '网格化管理将治理触角延伸至每个单元，实现责任到人、精细化服务。', type: 'single' },
    ]
  };
  for (const b of QUESTION_BANKS) {
    const add = EXTRA[b.id];
    if (add) b.questions.push(...add);
  }
})();
