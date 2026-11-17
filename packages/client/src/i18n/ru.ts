import type { Dict, TKey } from './en';

const ru: Dict = {
  'app.title': 'Нулевое доверие',

  'topbar.policyChanges': 'ИЗМЕНЕНИЯ ПОЛИТИКИ {used}/{max}',
  'topbar.turn': 'Ход {turn} из {limit}',
  'topbar.reset': 'Новая игра',
  'topbar.help': 'Справка',
  'topbar.language': 'Язык',

  'side.state': 'Корпорация',
  'side.terrorist': 'Коллектив',

  'indicator.stability': 'Стабильность бизнеса',
  'indicator.legitimacy': 'Доверие публики',
  'indicator.security': 'Анонимность',
  'indicator.mobilization': 'Размер сообщества',

  'target.stateBudget': 'Казна корпорации',
  'target.terroristBudget': 'Фонды коллектива',

  'plan.title': '{side}: спланируйте ход',
  'plan.submit': 'ОТДАТЬ ПРИКАЗЫ',
  'plan.drawOffer': 'Предложить ничью',
  'plan.errorsTitle': 'Приказы нельзя отдать:',
  'plan.projection': 'Прогноз на этот ход',
  'plan.now': 'сейчас',

  'action.increase': 'Повысить уровень',
  'action.decrease': 'Понизить уровень',

  'handoff.title': 'Передайте устройство',
  'handoff.to': 'Передайте устройство: {side}',
  'handoff.confirm': 'Я — {side}, продолжить',
  'handoff.privacy':
    'Отданные приказы скрыты, пока обе стороны не подтвердят свои.',

  'reveal.title': 'Приказы раскрыты',
  'reveal.turn': 'Ход {turn}',
  'reveal.show': 'Решить ход',
  'reveal.summary': 'Итоги хода {turn}',
  'reveal.continue': 'Продолжить',
  'reveal.noChanges': 'Без изменений — удерживаем позицию',
  'reveal.agreesDraw': 'предлагает ничью',
  'reveal.changesTitle': 'Изменения: {side}',
  'reveal.levelArrow': 'У{from} → У{to}',

  'over.title': 'Игра окончена',
  'over.wins': 'Победа: {side}',
  'over.draw': 'Ничья',
  'over.reasons': 'Причины',
  'over.stats': 'Итоговая статистика',
  'over.rematch': 'Реванш',
  'over.turns': 'Сыграно ходов: {turns}',

  'fin.title': 'ФИНАНСЫ',
  'fin.budget': 'Бюджет',
  'fin.bank': 'Резерв',
  'fin.activeUpkeep': 'Содержание (активно)',
  'fin.afterUpkeep': 'Содержание (после изменений)',
  'fin.nextIncome': 'Доход на след. ход',
  'fin.insolvent': 'Неплатёжеспособность: содержание превышает бюджет + резерв',

  'danger.title': 'РИСК',
  'danger.safe': 'Безопасно',
  'danger.grace': 'Порог достигнут — отсрочка',
  'danger.sustained': 'Удержание {count}/{max}',
  'danger.criticalGrace': 'КРИТИЧЕСКИЙ уровень — отсрочка',
  'danger.critical': 'КРИТИЧЕСКИ',
  'danger.bandCritical': 'критично ≤{value}',
  'danger.bandSustained': 'удержание ≤{value}',

  'rail.history': 'ИСТОРИЯ',
  'rail.events': 'СОБЫТИЯ',

  'graph.effectsTitle': 'Эффекты за ход на каждом уровне',
  'graph.own': 'Свои',
  'graph.opponent': 'Противника',
  'graph.current': 'Сейчас: У{level}',
  'graph.after': 'После приказов: У{level}',
  'graph.upkeep': 'содержание',
  'graph.pending': 'ожидает {delta}',

  'feed.effect': '{side} · {policy} → {target}: {delta} (сейчас {value})',
  'feed.effectNoValue': '{side} · {policy} → {target}: {delta}',
  'feed.economy':
    '{side}: расход {spend} · доход {income} → бюджет {budget}, резерв {bank}',
  'feed.economyBankrupt':
    '{side} банкрот: расход {spend} > бюджет {budget} + резерв {bank}',

  'help.title': 'Справка и таблицы политик',
  'help.howTitle': 'Как проходит ход',
  'help.howText':
    '1. Обе стороны тайно выбирают до {max} изменений политик (по одному шагу уровня) и могут предложить ничью.\n' +
    '2. Приказы раскрываются одновременно и решаются: активные политики дают эффекты, затем каждая сторона платит содержание — сначала с бюджета, затем с резерва.\n' +
    '3. Если содержание превышает бюджет + резерв, сторона обанкротившейся проигрывает.\n' +
    '4. Платёжеспособные стороны получают доход на следующий ход; непотраченный бюджет переходит в резерв.\n' +
    '5. Показатели ограничены диапазоном 0–100. Стабильность бизнеса и Доверие публики (Корпорация), а также Анонимность и Размер сообщества (Коллектив) на уровне ≤ {sustained} в течение {sustainedTurns} учитываемых ходов — или ≤ {critical} во второй ход подряд — проигрывают игру.\n' +
    '6. Изменения вступают в силу немедленно, в конце того хода, в котором отданы. Игра решается на {limit}-м ходе или по обоюдному согласию.',
  'help.policies': 'Таблицы политик (правила v{version})',
  'help.close': 'Закрыть',
  'help.level': 'Уровень',
  'help.policy': 'Политика',

  'mode.subtitle': 'Два игрока. Один экран или два.',
  'mode.hotseat': 'Hot-seat (одно устройство)',
  'mode.online': 'Онлайн (два устройства)',

  'auth.title': 'Войдите, чтобы играть онлайн',
  'auth.email': 'Эл. почта',
  'auth.password': 'Пароль',
  'auth.displayName': 'Имя (необязательно)',
  'auth.login': 'Войти',
  'auth.register': 'Создать аккаунт',
  'auth.switchToRegister': 'Нет аккаунта? Создать',
  'auth.switchToLogin': 'Уже зарегистрированы? Войти',
  'auth.logout': 'Выйти',
  'auth.badCredentials': 'Неверная почта или пароль',
  'auth.duplicateEmail': 'Эта почта уже зарегистрирована',
  'auth.forgot': 'Забыли пароль?',
  'auth.forgotTitle': 'Сброс пароля',
  'auth.forgotSubmit': 'Отправить ссылку',
  'auth.forgotSent': 'Если эта почта зарегистрирована, ссылка для сброса отправлена. Проверьте входящие.',
  'auth.resetTitle': 'Новый пароль',
  'auth.newPassword': 'Новый пароль',
  'auth.confirmPassword': 'Повторите пароль',
  'auth.resetSubmit': 'Сбросить пароль',
  'auth.resetDone': 'Пароль обновлён — войдите с новым паролем.',
  'auth.resetMismatch': 'Пароли не совпадают',

  'lobby.signedInAs': 'Вы вошли как',
  'lobby.create': 'Создать игру',
  'lobby.playAs': 'Играть за',
  'lobby.join': 'Войти по коду',
  'lobby.joinButton': 'Присоединиться',
  'lobby.codePlaceholder': '8-символьный код',
  'lobby.waiting': 'Ждём, пока противник присоединится…',
  'lobby.shareCode': 'Отправьте этот код приглашения противнику:',
  'lobby.youAre': 'Вы играете за: {side}',
  'lobby.cancel': 'Отмена',
  'lobby.or': 'или',
  'lobby.codeNotFound': 'Игра с таким кодом не найдена',

  'online.loading': 'Загрузка игры…',
  'online.reconnecting': 'Связь потеряна — переподключение…',
  'online.submitFailed': 'Не удалось отдать приказы: {message}',
  'online.waitingTitle': 'Приказы приняты',
  'online.waitingBody': 'Ждём, пока противник отдаст свои приказы…',
  'online.opponentSubmitted': 'Противник отдал приказы',
  'online.opponentThinking': 'Противник ещё планирует',
  'online.opponentAway': 'Противник не в сети',
  'online.backToLobby': 'Вернуться в лобби',

  'obs.badge': 'НАБЛЮДЕНИЕ',
  'obs.copyLink': 'Скопировать ссылку наблюдателя',
  'obs.linkCopied': 'Ссылка скопирована!',
  'obs.copyFailed': 'Не удалось скопировать — скопируйте ссылку вручную',
  'obs.export': 'Экспорт CSV',
  'obs.exportFailed': 'Не удалось экспортировать: {message}',
  'obs.waiting': 'Ходы ещё не раскрыты — приказы появятся здесь после вскрытия.',
  'obs.unknown': 'Ссылка наблюдателя недействительна.',
  'obs.exit': 'Выйти',

  'replay.title': 'Повтор',
  'replay.turnOf': 'Ход {turn} из {total}',
  'replay.prev': 'Предыдущий ход',
  'replay.next': 'Следующий ход',
  'replay.latest': 'К последнему ходу',
  'replay.close': 'Закрыть',
};

export default ru;

export type { TKey };
