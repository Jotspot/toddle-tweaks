/* Toddle Tweaks — Classroom themes: Google Classroom's own banner illustrations + their base colours. */
(() => {
  const TT = window.TT;
  const BASE = 'https://www.gstatic.com/classroom/themes/';

  // id → [label, base colour sampled from the image]
  const THEMES = {
    Chemistry: ['Chemistry', '#863a95'],
    Math: ['Math', '#d91a60'],
    Physics: ['Physics', '#4167b2'],
    Biology: ['Biology', '#108a7d'],
    English: ['English', '#0678be'],
    Geography: ['Geography', '#0b7a6a'],
    Economics: ['Economics', '#30ae71'],
    Psychology: ['Psychology', '#536d7a'],
    Writing: ['Writing', '#775ba6'],
    Honors: ['Honors', '#36474f'],
    SocialStudies: ['Social studies', '#e8930c'],
    img_code: ['Code', '#566e7a'],
    img_learnlanguage: ['Languages', '#3367d5'],
    img_bookclub: ['Book club', '#32ac71'],
    img_read: ['Reading', '#566e7a'],
    img_backtoschool: ['Back to school', '#0277bd'],
    img_graduation: ['Graduation', '#3383f2'],
    img_reachout: ['Reach out', '#009788'],
    img_breakfast: ['Breakfast', '#ff8b66'],
    img_hiking: ['Hiking', '#00887a'],
    img_camping: ['Camping', '#00695b'],
    img_climbing: ['Climbing', '#646464'],
    img_cooking: ['Cooking', '#848484'],
    img_tennis: ['Tennis', '#32ac71'],
    img_soccer: ['Soccer', '#0a8043'],
    img_swimming: ['Swimming', '#019be1'],
    img_volleyball: ['Volleyball', '#0387d2'],
    img_golf: ['Golf', '#32ac71'],
    img_coffee: ['Coffee', '#90a4ad'],
    img_concert: ['Concert', '#004c40'],
    img_bbq: ['BBQ', '#ff5353'],
    img_handcraft: ['Crafts', '#8e22a9'],
  };

  const RULES = [
    [/chem/i, 'Chemistry'],
    [/\b(math|calc|algebra|geometr|precalc|statistic|trig)/i, 'Math'],
    [/physic/i, 'Physics'],
    [/\b(bio|life science|environment)/i, 'Biology'],
    [/\b(computer|\bcs\b|cod(e|ing)|program|robot|engineer)/i, 'img_code'],
    [/\b(english|literature|\blit\b)/i, 'English'],
    [/\b(history|government|civics|social studies|world)/i, 'SocialStudies'],
    [/econ/i, 'Economics'],
    [/geograph/i, 'Geography'],
    [/psych/i, 'Psychology'],
    [/\b(writing|journalism|creative)/i, 'Writing'],
    [/\b(chinese|mandarin|spanish|french|german|japanese|korean|latin|language)/i, 'img_learnlanguage'],
    [/climb/i, 'img_climbing'],
    [/swim/i, 'img_swimming'],
    [/\b(soccer|football)/i, 'img_soccer'],
    [/\b(pe\b|physical|sport|fitness|adventure|outdoor|athlet)/i, 'img_hiking'],
    [/\b(music|band|choir|orchestra|concert)/i, 'img_concert'],
    [/\b(art|design|craft|ceramic|studio)/i, 'img_handcraft'],
    [/\b(library|reading|book)/i, 'img_bookclub'],
    [/\b(cook|culinary|food)/i, 'img_cooking'],
    [/\b(is:|interim|travel|trip)/i, 'img_camping'],
    [/\b(advisory|homeroom|caseload|case manager|counsel|pac\b)/i, 'img_reachout'],
    [/\b(learning|life skills|tutorial|wellness)/i, 'img_graduation'],
    [/\b(block|flex|study hall)/i, 'img_backtoschool'],
    [/\b(honou?rs|\bap\b|\bib\b)/i, 'Honors'],
  ];
  const FALLBACK = ['img_backtoschool', 'img_bookclub', 'img_breakfast', 'img_graduation', 'img_coffee', 'img_tennis', 'Writing', 'Geography'];

  // ---------- original banner art (no third-party images) ----------
  const MOTIF = {
    Chemistry: 'science', Physics: 'science', Biology: 'science', Math: 'calculate', English: 'book', Writing: 'edit',
    Geography: 'language', Economics: 'calculate', Psychology: 'people', Honors: 'school', SocialStudies: 'history',
    img_code: 'code', img_learnlanguage: 'language', img_bookclub: 'book', img_read: 'book', img_backtoschool: 'school',
    img_graduation: 'school', img_reachout: 'people', img_breakfast: 'calendar', img_hiking: 'sports', img_camping: 'language',
    img_climbing: 'sports', img_cooking: 'calendar', img_tennis: 'sports', img_soccer: 'sports', img_swimming: 'sports',
    img_volleyball: 'sports', img_golf: 'sports', img_coffee: 'description', img_concert: 'music', img_bbq: 'calendar', img_handcraft: 'palette',
  };
  const patternCache = {};
  const patternUrl = (id) => {
    if (patternCache[id]) return patternCache[id];
    const color = (THEMES[id] || THEMES.img_backtoschool)[1];
    const path = TT.ICONS[MOTIF[id] || 'school'] || TT.ICONS.school;
    let n = 0; for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    const a = 760 + (n % 60), b = 40 + (n % 40);
    let dots = '';
    for (let i = 0; i < 18; i++) dots += `<circle cx='${560 + (i % 6) * 26}' cy='${150 + Math.floor(i / 6) * 26}' r='3' fill='white' fill-opacity='.22'/>`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1010 250' preserveAspectRatio='xMaxYMid slice'>`
      + `<defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='${color}'/><stop offset='1' stop-color='${color}' stop-opacity='.82'/></linearGradient></defs>`
      + `<rect width='1010' height='250' fill='${color}'/><rect width='1010' height='250' fill='url(#g)'/>`
      + `<circle cx='${a}' cy='${b}' r='190' fill='white' fill-opacity='.10'/>`
      + `<circle cx='${a + 170}' cy='230' r='120' fill='black' fill-opacity='.08'/>`
      + `<circle cx='${a - 60}' cy='200' r='70' fill='none' stroke='white' stroke-opacity='.25' stroke-width='6'/>`
      + dots
      + `<g transform='translate(790 14) scale(5.2)' fill='white' fill-opacity='.9'><path d='${path}'/></g>`
      + `<g transform='translate(600 40) rotate(-12) scale(3.2)' fill='white' fill-opacity='.16'><path d='${path}'/></g>`
      + `</svg>`;
    patternCache[id] = 'data:image/svg+xml,' + encodeURIComponent(svg);
    return patternCache[id];
  };

  const prefs = () => TT.lsGet('tt:gc', {}) || {};
  const savePrefs = (p) => TT.lsSet('tt:gc', p);

  TT.themes = {
    all: THEMES,
    // Banner art: Google's Classroom illustrations, or original generated patterns.
    url: (id) => (TT.settings.googleBanners ? BASE + id + '.jpg' : patternUrl(id)),
    forCourse(course) {
      const p = prefs();
      const chosen = p.themes && p.themes[course.id];
      if (chosen && THEMES[chosen]) return chosen;
      const title = course.originalTitle || course.title || '';
      for (const [re, id] of RULES) if (re.test(title)) return id;
      let n = 0; for (const ch of String(course.id)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
      return FALLBACK[n % FALLBACK.length];
    },
    color(course) { return THEMES[TT.themes.forCourse(course)][1]; },
    set(courseId, themeId) {
      const p = prefs();
      p.themes = { ...(p.themes || {}), [courseId]: themeId };
      savePrefs(p);
    },
  };
  TT.gcPrefs = prefs;
  TT.gcSavePrefs = savePrefs;

  // Course colour everywhere now follows the Classroom theme.
  TT.courseColor = (id, title) => TT.themes.color({ id, title: title || '' });
})();
