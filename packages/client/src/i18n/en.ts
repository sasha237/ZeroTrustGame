const en = {
  'app.title': 'Zero Trust',

  'topbar.policyChanges': 'POLICY CHANGES {used}/{max}',
  'topbar.turn': 'Turn {turn} of {limit}',
  'topbar.reset': 'New game',
  'topbar.help': 'Help',
  'topbar.language': 'Language',

  'side.state': 'Corporation',
  'side.terrorist': 'Collective',

  'indicator.stability': 'Market stability',
  'indicator.legitimacy': 'Public trust',
  'indicator.security': 'Anonymity',
  'indicator.mobilization': 'Community size',

  'target.stateBudget': 'Corporate treasury',
  'target.terroristBudget': 'Collective funds',

  'plan.title': '{side}: plan your move',
  'plan.submit': 'SUBMIT ORDERS',
  'plan.drawOffer': 'Propose a draw',
  'plan.errorsTitle': 'Orders cannot be submitted:',
  'plan.projection': 'Projection for this turn',
  'plan.now': 'now',

  'action.increase': 'Increase level',
  'action.decrease': 'Decrease level',

  'handoff.title': 'Pass the device',
  'handoff.to': 'Hand the device to {side}',
  'handoff.confirm': 'I am {side} — continue',
  'handoff.privacy': 'Orders already submitted stay hidden until both sides have locked in.',

  'reveal.title': 'Orders revealed',
  'reveal.turn': 'Turn {turn}',
  'reveal.show': 'Resolve the turn',
  'reveal.summary': 'Turn {turn} resolution',
  'reveal.continue': 'Continue',
  'reveal.noChanges': 'No changes — holding position',
  'reveal.agreesDraw': 'proposes a draw',
  'reveal.changesTitle': '{side} changes',
  'reveal.levelArrow': 'L{from} → L{to}',

  'over.title': 'Game over',
  'over.wins': '{side} wins',
  'over.draw': 'Draw',
  'over.reasons': 'Reasons',
  'over.stats': 'Final statistics',
  'over.rematch': 'Rematch',
  'over.turns': 'Turns played: {turns}',

  'fin.title': 'FINANCES',
  'fin.budget': 'Budget',
  'fin.bank': 'Bank',
  'fin.activeUpkeep': 'Upkeep (active)',
  'fin.afterUpkeep': 'Upkeep (after changes)',
  'fin.nextIncome': 'Income next turn',
  'fin.insolvent': 'Insolvent: upkeep exceeds budget + bank',

  'danger.title': 'DANGER',
  'danger.safe': 'Safe',
  'danger.grace': 'Threshold hit — grace',
  'danger.sustained': 'Sustained {count}/{max}',
  'danger.criticalGrace': 'CRITICAL hit — grace',
  'danger.critical': 'CRITICAL',
  'danger.bandCritical': 'critical ≤{value}',
  'danger.bandSustained': 'sustained ≤{value}',

  'rail.history': 'HISTORY',
  'rail.events': 'EVENTS',

  'graph.effectsTitle': 'Effects per turn at each level',
  'graph.own': 'Own',
  'graph.opponent': 'Opponent',
  'graph.current': 'Current: L{level}',
  'graph.after': 'After orders: L{level}',
  'graph.upkeep': 'upkeep',
  'graph.pending': 'pending {delta}',

  'feed.effect': '{side} · {policy} → {target}: {delta} (now {value})',
  'feed.effectNoValue': '{side} · {policy} → {target}: {delta}',
  'feed.economy': '{side}: spend {spend} · income {income} → next budget {budget}, bank {bank}',
  'feed.economyBankrupt':
    '{side} bankrupt: spend {spend} > budget {budget} + bank {bank}',

  'help.title': 'Help & policy tables',
  'help.howTitle': 'How a turn works',
  'help.howText':
    '1. Both sides secretly pick up to {max} policy changes (one level step each) and may propose a draw.\n' +
    '2. Orders are revealed simultaneously and resolve: active policies apply their effects, then each side pays upkeep — first from budget, then from bank.\n' +
    '3. If upkeep exceeds budget + bank, that side goes bankrupt and loses.\n' +
    '4. Solvent sides earn income for the next turn; unspent budget moves to the bank.\n' +
    '5. Indicators are clamped to 0–100. The Corporation\'s Market stability and Public trust, and the Collective\'s Anonymity and Community size, at or below {sustained} for {sustainedTurns} counted turns — or at/below {critical} on a second consecutive turn — lose the game.\n' +
    '6. Changes take effect immediately, at the end of the turn they are ordered in. The game is decided at turn {limit} or by mutual agreement.',
  'help.policies': 'Policy tables (ruleset v{version})',
  'help.close': 'Close',
  'help.level': 'Level',
  'help.policy': 'Policy',

  'mode.subtitle': 'Two players. One screen or two.',
  'mode.hotseat': 'Hot-seat (one device)',
  'mode.online': 'Online (two devices)',

  'auth.title': 'Sign in to play online',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'Display name (optional)',
  'auth.login': 'Sign in',
  'auth.register': 'Create account',
  'auth.switchToRegister': 'No account yet? Create one',
  'auth.switchToLogin': 'Already registered? Sign in',
  'auth.logout': 'Sign out',
  'auth.badCredentials': 'Invalid email or password',
  'auth.duplicateEmail': 'This email is already registered',
  'auth.forgot': 'Forgot password?',
  'auth.forgotTitle': 'Reset your password',
  'auth.forgotSubmit': 'Send reset link',
  'auth.forgotSent': 'If this email is registered, a reset link is on its way. Check your inbox.',
  'auth.resetTitle': 'Choose a new password',
  'auth.newPassword': 'New password',
  'auth.confirmPassword': 'Repeat new password',
  'auth.resetSubmit': 'Reset password',
  'auth.resetDone': 'Password updated — sign in with your new password.',
  'auth.resetMismatch': 'Passwords do not match',

  'lobby.signedInAs': 'Signed in as',
  'lobby.create': 'Create game',
  'lobby.playAs': 'Play as',
  'lobby.join': 'Join with a code',
  'lobby.joinButton': 'Join game',
  'lobby.codePlaceholder': '8-character code',
  'lobby.waiting': 'Waiting for your opponent to join…',
  'lobby.shareCode': 'Share this invite code with your opponent:',
  'lobby.youAre': 'You are {side}',
  'lobby.cancel': 'Cancel',
  'lobby.or': 'or',
  'lobby.codeNotFound': 'No game found with this code',

  'online.loading': 'Loading game…',
  'online.reconnecting': 'Connection lost — reconnecting…',
  'online.submitFailed': 'Submit failed: {message}',
  'online.waitingTitle': 'Orders locked in',
  'online.waitingBody': 'Waiting for your opponent to submit their orders…',
  'online.opponentSubmitted': 'Your opponent has submitted their orders',
  'online.opponentThinking': 'Your opponent is still planning',
  'online.opponentAway': 'Your opponent is offline',
  'online.backToLobby': 'Back to lobby',

  'obs.badge': 'OBSERVING',
  'obs.copyLink': 'Copy observer link',
  'obs.linkCopied': 'Link copied!',
  'obs.copyFailed': 'Copy failed — copy the link manually',
  'obs.export': 'Export CSV',
  'obs.exportFailed': 'Export failed: {message}',
  'obs.waiting': 'No turns resolved yet — orders appear here once revealed.',
  'obs.unknown': 'This observer link is invalid.',
  'obs.exit': 'Exit',

  'replay.title': 'Replay',
  'replay.turnOf': 'Turn {turn} of {total}',
  'replay.prev': 'Previous turn',
  'replay.next': 'Next turn',
  'replay.latest': 'Jump to latest',
  'replay.close': 'Close',
} as const;

export default en;

export type TKey = keyof typeof en;
export type Dict = Record<TKey, string>;
