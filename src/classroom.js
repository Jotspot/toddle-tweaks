/* Toddle Tweaks — classic (non-Classroom) mode: smart to-do replaces the home deadlines widget. */
(() => {
  const TT = window.TT;
  const { h } = TT;

  TT.mountSmartPanel = () => {
    const existing = document.getElementById('tt-smart-panel');
    if (!TT.settings.smartTodo || TT.settings.classroomMode || !TT.isHomePath()) { if (existing && TT.settings.classroomMode) existing.remove(); return; }
    const right = document.querySelector('[class*="StudentCourses__rightContainerV2"]');
    if (!right || right.querySelector('#tt-smart-panel')) return;
    const panel = h('div', { id: 'tt-smart-panel' });
    const widget = right.querySelector('[class*="StudentCourses__deadlinesWidgetContainerV2"]');
    if (widget) widget.before(panel); else right.prepend(panel);
    TT.renderTodo(panel, 'panel');
  };
})();
