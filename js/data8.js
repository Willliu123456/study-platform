/* ============ 学升题库扩充（第8批）四六级 part1 ============ */
(function () {
  const EXTRA = {
    cet: [
      { id: 'cet15', kp: '词汇', diff: 2, q: 'The manager decided to ________ the meeting until next week.', opts: ['postpone', 'postcard', 'poster', 'posture'], ans: 0, explain: 'postpone 意为"推迟"，符合会议延期的语境。', type: 'single' },
      { id: 'cet16', kp: '阅读理解', diff: 2, q: 'What is the main purpose of the article?', opts: ['To inform readers about a new trend', 'To persuade people to buy a product', 'To entertain with a story', 'To complain about a service'], ans: 0, explain: '文章目的是告知读者一种新趋势。', type: 'single' },
      { id: 'cet17', kp: '语法', diff: 2, q: 'I wish I ________ more time to read books.', opts: ['had', 'have', 'will have', 'am having'], ans: 0, explain: 'wish 后接虚拟语气，与现在事实相反用过去时 had。', type: 'single' },
      { id: 'cet18', kp: '词汇', diff: 2, q: 'The ________ of the report is about environmental protection.', opts: ['theme', 'thief', 'thigh', 'thick'], ans: 0, explain: 'theme 意为"主题"，符合报告主题语境。', type: 'single' },
      { id: 'cet19', kp: '翻译', diff: 2, q: '"绿水青山就是金山银山"的最佳英文翻译是（　）', opts: ['Lucid waters and lush mountains are invaluable assets.', 'Green water and green mountains are gold.', 'Water and mountains are both valuable.', 'Beautiful nature brings money.'], ans: 0, explain: '官方译法：Lucid waters and lush mountains are invaluable assets。', type: 'single' },
      { id: 'cet20', kp: '词汇', diff: 2, q: 'He was ________ for his bravery in the face of danger.', opts: ['admired', 'admitted', 'advanced', 'advised'], ans: 0, explain: 'admire 意为"钦佩、赞赏"，be admired for 为"因…而受赞赏"。', type: 'single' },
      { id: 'cet21', kp: '阅读理解', diff: 3, q: 'The word "significant" in the passage is closest in meaning to ________.', opts: ['important', 'slight', 'strange', 'serious'], ans: 0, explain: 'significant 意为"重要的"，与 important 同义。', type: 'single' },
      { id: 'cet22', kp: '语法', diff: 3, q: 'It was not until midnight ________ he finished his homework.', opts: ['that', 'when', 'which', 'where'], ans: 0, explain: '强调句型 It was not until...that...，强调时间状语。', type: 'single' },
      { id: 'cet23', kp: '词汇', diff: 2, q: 'The government is trying to ________ pollution in the city.', opts: ['reduce', 'reproduce', 'reuse', 'rebel'], ans: 0, explain: 'reduce pollution 意为"减少污染"。', type: 'single' },
      { id: 'cet24', kp: '翻译', diff: 2, q: '"春节"的标准英文表达是（　）', opts: ['the Spring Festival', 'the Spring Day', 'the New Year Festival', 'the Spring Holiday'], ans: 0, explain: '春节的英文表达为 the Spring Festival（或 Chinese New Year）。', type: 'single' },
      { id: 'cet25', kp: '阅读理解', diff: 2, q: 'According to the passage, which of the following is NOT mentioned?', opts: ['The cost of living in big cities', 'The benefits of rural life', 'The history of urban planning', 'The author\'s personal experience'], ans: 2, explain: '细节判断题，文中未提及城市规划的历史，其余均有涉及。', type: 'single' },
      { id: 'cet26', kp: '语法', diff: 2, q: '________ the rain, the sports meeting was still held on time.', opts: ['Despite', 'Because', 'Besides', 'Except'], ans: 0, explain: 'despite 意为"尽管"，引导让步，后接名词。', type: 'single' },
      { id: 'cet27', kp: '词汇', diff: 3, q: 'The word "obstacle" most nearly means ________.', opts: ['barrier', 'bridge', 'bonus', 'budget'], ans: 0, explain: 'obstacle 意为"障碍"，与 barrier 同义。', type: 'single' },
      { id: 'cet28', kp: '阅读理解', diff: 3, q: 'What can be inferred from the last paragraph?', opts: ['The author is optimistic about the future.', 'The author is worried about the current situation.', 'The author suggests giving up.', 'The author calls for immediate action.'], ans: 0, explain: '从末段积极展望的表达可推断作者对未来持乐观态度。', type: 'single' },
    ]
  };
  for (const b of QUESTION_BANKS) {
    const add = EXTRA[b.id];
    if (add) b.questions.push(...add);
  }
})();
