const algorithmData = [
  {
    title: "Алгоритм при анафилаксии",
    steps: [
      "Прекратить введение аллергена",
      "Положить пациента горизонтально",
      "Обеспечить доступ к венам",
      "Ввести адреналин 0,3–0,5 мл в/м",
      "Наблюдение и повторная доза при необходимости"
    ]
  },
  {
    title: "Алгоритм при остановке сердца",
    steps: [
      "Проверить сознание и дыхание",
      "Вызвать скорую помощь",
      "Начать СЛР: 30 компрессий, 2 вдоха",
      "Использовать дефибриллятор при наличии",
      "Продолжать до прибытия помощи"
    ]
  },
  {
    title: "Алгоритм при гипогликемии",
    steps: [
      "Измерить уровень глюкозы в крови",
      "Дать быстрые углеводы (сок, глюкоза)",
      "Повторная проверка через 15 минут",
      "Дать медленные углеводы (хлеб, печенье)",
      "Обратиться к врачу, если симптомы сохраняются"
    ]
  }
];

document.getElementById('show-algorithms-btn').addEventListener('click', () => {
  const container = document.getElementById('algorithms-container');
  if (!container) return;
  container.classList.remove('d-none');
  const list = document.getElementById('algorithm-list');
  list.innerHTML = '';
  algorithmData.forEach((alg, index) => {
    const item = document.createElement('li');
    item.className = 'list-group-item list-group-item-action';
    item.textContent = alg.title;
    item.onclick = () => showAlgorithm(index);
    list.appendChild(item);
  });
});

function showAlgorithm(index) {
  const container = document.getElementById('algorithm-interactive');
  const title = document.getElementById('algorithm-title');
  const list = document.getElementById('algorithm-steps');
  const alg = algorithmData[index];

  title.textContent = alg.title;
  list.innerHTML = '';
  container.classList.remove('d-none');

  const shuffled = [...alg.steps].sort(() => Math.random() - 0.5);
  shuffled.forEach((step, idx) => {
    const li = document.createElement('li');
    li.className = 'list-group-item draggable';
    li.draggable = true;
    li.textContent = step;

    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', idx);
      li.classList.add('bg-secondary', 'text-white');
    });

    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', e => {
      e.preventDefault();
      const fromIdx = +e.dataTransfer.getData('text/plain');
      const toIdx = [...list.children].indexOf(li);
      const nodeList = [...list.children];
      list.insertBefore(nodeList[fromIdx], nodeList[toIdx]);
    });

    li.addEventListener('dragend', () => {
      li.classList.remove('bg-secondary', 'text-white');
    });

    list.appendChild(li);
  });

  document.getElementById('check-order-btn').onclick = () => {
    const userSteps = [...list.children].map(li => li.textContent);
    list.childNodes.forEach((li, i) => {
      li.classList.remove('list-group-item-success', 'list-group-item-danger');
      if (userSteps[i] === alg.steps[i]) {
        li.classList.add('list-group-item-success');
      } else {
        li.classList.add('list-group-item-danger');
      }
    });
  };
}