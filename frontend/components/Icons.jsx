const paths = {
  warning: ['M12 9v4M12 17h.01M10.3 4.4 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.4a2 2 0 0 0-3.4 0Z'],
  dashboard: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  questions: ['M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4M9 2h6v4H9zM10 11a2 2 0 1 1 3 1.7c-1 .6-1 1-1 1.8M12 18h.01'],
  students: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87', 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  classes: ['M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 7h.01M16 7h.01M8 11h.01M16 11h.01'],
  subjects: ['M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15'],
  quizzes: ['M9 3H5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4M9 2h6v4H9zM7 11h10M7 15h10M7 19h6'],
  assignments: ['M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M9 16l2 2 4-4'],
  results: ['M3 3v18h18M7 16v-4M12 16V7M17 16v-7'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['M6 6l12 12M6 18 18 6'],
  collapse: ['M15 6l-6 6 6 6'],
  expand: ['M9 6l6 6-6 6'],
  chevron: ['M6 9l6 6 6-6'],
  play: ['M8 5v14l11-7z'],
  profile: ['M20 21v-2a7 7 0 0 0-14 0v2', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
  empty: ['M8 3h8l5 9v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8l5-9M3 12h5l2 3h4l2-3h5']
};
export default function Icon({ name, className }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(paths[name] || paths.dashboard).map((path, index) => <path key={index} d={path} />)}</svg>;
}
