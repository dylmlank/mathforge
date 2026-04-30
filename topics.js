const TOPICS = [
  {
    id: 'algebra', label: 'Algebra', color: 'var(--purple)', icon: '\u2211',
    gradient: 'var(--gradient-1)',
    subtopics: [
      { id: 'equations', label: 'Equations & Inequalities', plotType: 'function' },
      { id: 'functions', label: 'Functions & Graphs', plotType: 'function' },
      { id: 'polynomials', label: 'Polynomials', plotType: 'function' },
      { id: 'systems', label: 'Systems of Equations', plotType: 'function' },
    ]
  },
  {
    id: 'calculus', label: 'Calculus', color: 'var(--cyan)', icon: '\u222B',
    gradient: 'var(--gradient-2)',
    subtopics: [
      { id: 'limits', label: 'Limits', plotType: 'function' },
      { id: 'derivatives', label: 'Derivatives', plotType: 'derivative' },
      { id: 'integrals', label: 'Integrals', plotType: 'function' },
      { id: 'series', label: 'Series & Sequences', plotType: 'none' },
    ]
  },
  {
    id: 'statistics', label: 'Statistics & Probability', color: 'var(--orange)', icon: '\u03C3',
    gradient: 'var(--gradient-3)',
    subtopics: [
      { id: 'distributions', label: 'Distributions', plotType: 'distribution' },
      { id: 'hypothesis', label: 'Hypothesis Testing', plotType: 'distribution' },
      { id: 'combinatorics', label: 'Combinatorics', plotType: 'none' },
      { id: 'regression', label: 'Regression', plotType: 'histogram' },
    ]
  },
  {
    id: 'linear-algebra', label: 'Linear Algebra', color: 'var(--pink)', icon: '\u2297',
    gradient: 'var(--gradient-4)',
    subtopics: [
      { id: 'matrices', label: 'Matrices & Operations', plotType: 'matrix_transform' },
      { id: 'vectors', label: 'Vectors & Dot Product', plotType: 'vector2d' },
      { id: 'eigenvalues', label: 'Eigenvalues & Eigenvectors', plotType: 'none' },
      { id: 'transformations', label: 'Linear Transformations', plotType: 'matrix_transform' },
    ]
  },
];
