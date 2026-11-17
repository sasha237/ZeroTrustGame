import type { Policy } from '@bot/engine';
import type { Lang } from './index';

/**
 * Theme layer: cyberpunk reskin (Megacorporation vs Hacker collective). The ruleset
 * data keeps the original English names (engine logs/CSV stay unchanged); the client
 * UI renders these per-language titles/blurbs instead. Unknown ids or missing
 * languages fall back to the ruleset text, so new policies render until themed.
 */
const POLICY_TEXTS: Record<Lang, Record<string, { title: string; blurb: string }>> = {
  en: {
    counterFinances: {
      title: 'Asset Freeze',
      blurb: 'Choke the collective\'s funding through banks, exchanges and payment processors.',
    },
    counterNarrative: {
      title: 'Corporate PR',
      blurb: 'Media campaigns and influencers shaping public sentiment in the corp\'s favor.',
    },
    emergencyLegislation: {
      title: 'Emergency Directives',
      blurb: 'Extralegal executive powers to fight the hackers — at the cost of public trust.',
    },
    intelligence: {
      title: 'Threat Intelligence',
      blurb: 'Data analytics and OSINT operations against the collective\'s network.',
    },
    killCapture: {
      title: 'Counter-Ops Team',
      blurb: 'Tracing, raiding and disabling collective members and their infrastructure.',
    },
    leadershipTargeting: {
      title: 'Dox the Admins',
      blurb: 'Hunting the collective\'s core team and exposing their identities.',
    },
    internationalPartners: {
      title: 'Lobbying Bloc',
      blurb: 'Coordinated pressure with allied corporations and friendly governments.',
    },
    policing: {
      title: 'Corporate Security',
      blurb: 'Guards, checkpoints and hardened networks. Crackdowns also breed new recruits.',
    },
    reforms: {
      title: 'Perks & Benefits',
      blurb: 'Wage hikes, services and charity to drain the collective\'s appeal.',
    },
    taxes: {
      title: 'Monetization',
      blurb: 'Aggressive revenue extraction from users, data and subscriptions.',
    },
    attacks: {
      title: 'Cyberattacks',
      blurb: 'Hacks, leaks and outages that shake the corporation.',
    },
    fundraising: {
      title: 'Crypto Donations',
      blurb: 'Crowdfunding the movement across the globe.',
    },
    operationalSecurity: {
      title: 'OpSec & Encryption',
      blurb: 'Protecting identities, channels and infrastructure from corporate tracing.',
    },
    propaganda: {
      title: 'Memes & Manifestos',
      blurb: 'Shaping the public narrative against the corp.',
    },
    recruitment: {
      title: 'Recruitment',
      blurb: 'Onboarding new members through forums, darknet and word of mouth.',
    },
    safeHavens: {
      title: 'Offshore Servers',
      blurb: 'Bulletproof hosting beyond any jurisdiction\'s reach.',
    },
    socialServices: {
      title: 'Free Services',
      blurb: 'Free tools, leaked data and aid that win public sympathy.',
    },
    subversiveAction: {
      title: 'Supply-Chain Sabotage',
      blurb: 'Attacks on contractors and partners that erode trust in the corp.',
    },
    training: {
      title: 'Hacker School',
      blurb: 'Training camps, workshops and skill-sharing for the community.',
    },
  },
  ru: {
    counterFinances: {
      title: 'Блокировка активов',
      blurb: 'Перекрытие финансирования коллектива через банки, биржи и платёжные системы.',
    },
    counterNarrative: {
      title: 'Корпоративный PR',
      blurb: 'Медиакампании и инфлюенсеры, формирующие общественное мнение в пользу корпорации.',
    },
    emergencyLegislation: {
      title: 'Чрезвычайные директивы',
      blurb: 'Внеправовые полномочия руководства в борьбе с хакерами — ценой доверия публики.',
    },
    intelligence: {
      title: 'Аналитика угроз',
      blurb: 'Анализ данных и OSINT-операции против сети коллектива.',
    },
    killCapture: {
      title: 'Группа контрмер',
      blurb: 'Отслеживание, обыски и нейтрализация участников коллектива и их инфраструктуры.',
    },
    leadershipTargeting: {
      title: 'Доксинг админов',
      blurb: 'Охота на ключевую команду коллектива и раскрытие её личностей.',
    },
    internationalPartners: {
      title: 'Лоббистский блок',
      blurb: 'Согласованное давление вместе с союзными корпорациями и дружественными правительствами.',
    },
    policing: {
      title: 'Корпоративная безопасность',
      blurb: 'Охрана, контроль доступа и укрепление сетей. Репрессии при этом вдохновляют новобранцев.',
    },
    reforms: {
      title: 'Блага и привилегии',
      blurb: 'Повышение зарплат, соцпакет и благотворительность, оттягивающие сторонников коллектива.',
    },
    taxes: {
      title: 'Монетизация',
      blurb: 'Агрессивный сбор доходов с пользователей, данных и подписок.',
    },
    attacks: {
      title: 'Кибератаки',
      blurb: 'Взломы, утечки и отключения, подтачивающие корпорацию.',
    },
    fundraising: {
      title: 'Крипто-донаты',
      blurb: 'Народное финансирование движения по всему миру.',
    },
    operationalSecurity: {
      title: 'Опсек и шифрование',
      blurb: 'Защита личностей, каналов и инфраструктуры от корпоративной слежки.',
    },
    propaganda: {
      title: 'Мемы и манифесты',
      blurb: 'Формирование общественной повестки против корпорации.',
    },
    recruitment: {
      title: 'Вербовка',
      blurb: 'Привлечение новых участников через форумы, даркнет и сарафанное радио.',
    },
    safeHavens: {
      title: 'Офшорные серверы',
      blurb: 'Надёжный хостинг вне досягаемости любой юрисдикции.',
    },
    socialServices: {
      title: 'Бесплатные сервисы',
      blurb: 'Бесплатные инструменты, утечки данных и помощь, завоёвывающие симпатию публики.',
    },
    subversiveAction: {
      title: 'Саботаж цепочек поставок',
      blurb: 'Атаки на подрядчиков и партнёров, подрывающие доверие к корпорации.',
    },
    training: {
      title: 'Школа хакеров',
      blurb: 'Учебные лагеря, воркшопы и обмен навыками внутри сообщества.',
    },
  },
};

export function policyTitleOf(lang: Lang, policy: Pick<Policy, 'id' | 'title'>): string {
  return POLICY_TEXTS[lang][policy.id]?.title ?? policy.title;
}

export function policyBlurbOf(lang: Lang, policy: Pick<Policy, 'id' | 'blurb'>): string {
  return POLICY_TEXTS[lang][policy.id]?.blurb ?? policy.blurb;
}
