/* ============ 学升题库扩充（第7批）大学数学 part2 ============ */
(function () {
  const EXTRA = {
    sx: [
      { id: 'sx30', kp: '概率论与数理统计', diff: 2, q: '互斥事件与独立性的关系是（　）', opts: ['互斥且概率均大于0则必不独立', '互斥必独立', '独立必互斥', '没有关系'], ans: 0, explain: '互斥事件同时发生概率为0，独立事件同时发生概率为两者之积大于0，故互斥且概率大于0时必不独立。', type: 'single' },
      { id: 'sx31', kp: '高等数学', diff: 3, q: 'ln(1+x) 在 x=0 处展开式中 x³ 的系数为（　）', opts: ['1/3', '1/6', '-1/3', '-1/6'], ans: 0, explain: 'ln(1+x)=x-x²/2+x³/3-…，x³ 系数为 1/3。', type: 'single' },
      { id: 'sx32', kp: '线性代数', diff: 2, q: '设 A 为 3 阶方阵，|A|=2，则 |2A|=（　）', opts: ['16', '8', '6', '24'], ans: 0, explain: '|kA|=k³|A|=8×2=16。', type: 'single' },
      { id: 'sx33', kp: '概率论与数理统计', diff: 3, q: '设 X 服从二项分布 B(n,p)，则 D(X)=（　）', opts: ['np(1-p)', 'np', 'n(1-p)', 'p(1-p)'], ans: 0, explain: '二项分布的方差为 np(1-p)。', type: 'single' },
      { id: 'sx34', kp: '高等数学', diff: 2, q: '微分方程 y\'=2x 的通解为（　）', opts: ['y=x²+C', 'y=2x+C', 'y=x²', 'y=2x²+C'], ans: 0, explain: '对 2x 积分得 y=x²+C。', type: 'single' },
      { id: 'sx35', kp: '线性代数', diff: 3, q: '特征值 λ 对应的特征向量 x 满足（　）', opts: ['Ax=λx', 'Ax=λ', 'x=λA', 'Ax=0'], ans: 0, explain: '特征向量定义：Ax=λx（x≠0）。', type: 'single' },
      { id: 'sx36', kp: '高等数学', diff: 3, q: '曲线 y=x³-6x²+9x 的拐点为（　）', opts: ['x=2', 'x=1', 'x=3', 'x=0'], ans: 0, explain: '求二阶导数得 6x-12，令其为0得 x=2，两侧符号变化，为拐点。', type: 'single' },
      { id: 'sx37', kp: '概率论与数理统计', diff: 2, q: '设随机变量 X 的期望为 5，则 E(2X+3)=（　）', opts: ['13', '10', '8', '16'], ans: 0, explain: 'E(2X+3)=2×5+3=13。', type: 'single' },
      { id: 'sx38', kp: '线性代数', diff: 3, q: '二次型 x₁²+2x₂²+3x₃² 对应的矩阵是（　）', opts: ['diag(1,2,3)', '单位阵', '零矩阵', 'diag(3,2,1)'], ans: 0, explain: '标准形二次型对应对角矩阵 diag(1,2,3)。', type: 'single' },
      { id: 'sx39', kp: '高等数学', diff: 3, q: '反常积分 ∫₁^∞ 1/x² dx = （　）', opts: ['1', '2', '∞', '0'], ans: 0, explain: '∫₁^∞ 1/x² dx = -1/x 代入上下限得 1。', type: 'single' },
      { id: 'sx40', kp: '概率论与数理统计', diff: 3, q: '设 X、Y 相互独立，D(X)=4，D(Y)=9，则 D(X-Y)=（　）', opts: ['13', '5', '25', '36'], ans: 0, explain: '独立变量差的方差=D(X)+D(Y)=13。', type: 'single' },
      { id: 'sx41', kp: '高等数学', diff: 2, q: '函数 f(x)=x·eˣ 的导数 f\'(x)=（　）', opts: ['eˣ(1+x)', 'eˣ', 'xeˣ', 'eˣ·x²'], ans: 0, explain: '乘积法则：eˣ+x·eˣ=eˣ(1+x)。', type: 'single' },
      { id: 'sx42', kp: '线性代数', diff: 3, q: '设 3 阶矩阵 A 有 3 个互不相同的特征值，则 A（　）', opts: ['必可对角化', '必不可对角化', '未必可对角化', '必为零矩阵'], ans: 0, explain: 'n 阶矩阵有 n 个互异特征值时可对角化。', type: 'single' },
      { id: 'sx43', kp: '概率论与数理统计', diff: 2, q: '随机变量 X 的分布函数 F(x) 满足（　）', opts: ['F(+∞)=1', 'F(+∞)=0', 'F(-∞)=1', 'F(x) 递减'], ans: 0, explain: '分布函数右连续、非降，F(-∞)=0，F(+∞)=1。', type: 'single' },
      { id: 'sx44', kp: '高等数学', diff: 3, q: '定积分 ∫₀^π sinx dx = （　）', opts: ['2', '0', '1', 'π'], ans: 0, explain: '∫₀^π sinx dx = -cosx 代入上下限得 2。', type: 'single' },
    ]
  };
  for (const b of QUESTION_BANKS) {
    const add = EXTRA[b.id];
    if (add) b.questions.push(...add);
  }
})();
