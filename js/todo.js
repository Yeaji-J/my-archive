'use strict';

/* ---------------- To-do list ---------------- */

  function renderTodos() {
    todoList.innerHTML = '';

    todoEmpty.hidden =
      todos.length !== 0;

    todos.forEach(todo => {
      const item =
        document.createElement('li');

      item.className =
        'todo-item'
        + (todo.done ? ' done' : '');

      item.innerHTML = `
        <button
          class="todo-checkbox"
          aria-label="완료 체크"
          title="완료 체크"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M5 13l4 4L19 7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <span class="todo-text"></span>

        <button
          class="todo-del"
          aria-label="삭제"
          title="삭제"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke-linecap="round"
              stroke-width="2.2"
            />
          </svg>
        </button>
      `;

      item.querySelector(
        '.todo-text'
      ).textContent = todo.text;

      item
        .querySelector('.todo-checkbox')
        .addEventListener(
          'click',
          () => {
            todo.done = !todo.done;
            saveTodos();
            renderTodos();
          }
        );

      item
        .querySelector('.todo-del')
        .addEventListener(
          'click',
          () => {
            todos =
              todos.filter(
                current =>
                  current.id !== todo.id
              );

            saveTodos();
            renderTodos();
          }
        );

      todoList.appendChild(item);
    });
  }

  todoAddForm.addEventListener(
    'submit',
    event => {
      event.preventDefault();

      const text =
        todoInput.value.trim();

      if (!text) return;

      todos.unshift({
        id: uid(),
        text,
        done: false
      });

      todoInput.value = '';

      saveTodos();
      renderTodos();
    }
  );
