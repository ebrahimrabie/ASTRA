import { useCallback, useEffect, useState } from 'react';
import {
  fetchAchievementsApi,
  fetchEducationCardApi,
  submitEducationAnswersApi,
} from '../api/client';
import { Badge } from '../components/Badge';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type {
  AchievementCatalogItem,
  EducationAnswerFeedback,
  EducationCardDetail,
} from '../types';

const EDU_CARD_KEYS = [
  'edu_radiation',
  'edu_sleep',
  'edu_exercise',
  'edu_readiness',
] as const;

export function AchievementsPage() {
  const { authUser, showToast } = useAstra();
  const { lang, t, trError, formatNum, formatUtcIso } = useI18n();

  const [totalPoints, setTotalPoints] = useState(0);
  const [items, setItems] = useState<AchievementCatalogItem[]>([]);
  const [cards, setCards] = useState<Record<string, EducationCardDetail>>({});
  const [activeCardKey, setActiveCardKey] = useState<string>('edu_radiation');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number[]>>({});
  const [feedbackByCard, setFeedbackByCard] = useState<
    Record<string, { passed: boolean; feedback: EducationAnswerFeedback[] }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = useCallback(async () => {
    try {
      const cardEntries = await Promise.all(
        EDU_CARD_KEYS.map(async (key) => [key, await fetchEducationCardApi(key)] as const)
      );
      setCards(Object.fromEntries(cardEntries));

      if (authUser) {
        const summary = await fetchAchievementsApi();
        setTotalPoints(summary.totalPoints);
        setItems(summary.items);
      }
    } catch (err) {
      setErrorMsg(trError(err));
    }
  }, [authUser, trError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCard = cards[activeCardKey] ?? null;
  const activeAnswers =
    selectedAnswers[activeCardKey] ??
    (activeCard ? activeCard.questions.map(() => -1) : []);
  const activeResult = feedbackByCard[activeCardKey] ?? null;

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    setSelectedAnswers((prev) => {
      const curr =
        prev[activeCardKey] ??
        (activeCard ? activeCard.questions.map(() => -1) : []);
      const next = [...curr];
      next[qIdx] = optIdx;
      return { ...prev, [activeCardKey]: next };
    });
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard) return;
    if (activeAnswers.some((idx) => idx < 0)) {
      setErrorMsg(t('achievements.answerAllErr'));
      return;
    }
    setErrorMsg('');

    if (!authUser) {
      const localFeedback: EducationAnswerFeedback[] = activeCard.questions.map(
        (q, idx) => ({
          questionId: q.id,
          correct: activeAnswers[idx] === q.correctIndex,
          correctIndex: q.correctIndex,
          explanationKey: q.explanationKey,
        })
      );
      const passed = localFeedback.every((f) => f.correct);
      setFeedbackByCard((prev) => ({
        ...prev,
        [activeCard.key]: { passed, feedback: localFeedback },
      }));
      showToast(
        passed ? t('achievements.quizPassedPreviewToast') : t('achievements.quizRetryToast')
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitEducationAnswersApi(activeCard.key, activeAnswers);
      setFeedbackByCard((prev) => ({
        ...prev,
        [activeCard.key]: res,
      }));
      if (res.passed) {
        const summary = await fetchAchievementsApi();
        setTotalPoints(summary.totalPoints);
        setItems(summary.items);
        showToast(t('achievements.quizPassedToast'));
      } else {
        showToast(t('achievements.quizRetryToast'));
      }
    } catch (err) {
      setErrorMsg(trError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const earnedItems = items.filter((i) => i.unlockedAt !== null);
  const lockedItems = items.filter((i) => i.unlockedAt === null);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('achievements.title')}</h1>
          <p className="muted-text">{t('achievements.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <Badge label="PROTOTYPE DEFAULT" />
        </div>
      </div>

      <section className="hero-card" aria-labelledby="points-summary-heading">
        <div className="section-header">
          <div>
            <h2 id="points-summary-heading">{t('achievements.prototypePointsTitle')}</h2>
            <p className="muted-text">{t('achievements.privacyBanner')}</p>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div className="metric-value tabular-nums">
              {formatNum(totalPoints)}
            </div>
            <div className="small-text">{t('achievements.pointsUnit')}</div>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="form-error" role="alert">
          {errorMsg}
        </div>
      )}

      {!authUser && (
        <div className="banner" role="note">
          {t('achievements.demoSignInNote')}
        </div>
      )}

      {/* Educational Cards & 3-Question Quizzes */}
      <section className="card" aria-labelledby="edu-cards-heading">
        <div className="section-header">
          <h2 id="edu-cards-heading">{t('achievements.eduHeading')}</h2>
          <Badge label="ACTIVE" />
        </div>
        <p className="muted-text">{t('achievements.eduDesc')}</p>

        <div className="btn-row" role="tablist" aria-label={t('achievements.eduTabsAria')}>
          {EDU_CARD_KEYS.map((key) => {
            const card = cards[key];
            const isEarned = earnedItems.some((a) => a.key === key);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeCardKey === key}
                className={
                  activeCardKey === key ? 'btn btn-primary' : 'btn btn-secondary'
                }
                onClick={() => {
                  setActiveCardKey(key);
                  setErrorMsg('');
                }}
              >
                {card ? resolveKbText(card.titleKey, undefined, lang) : key}
                {isEarned ? ` ✓` : ''}
              </button>
            );
          })}
        </div>

        {activeCard && (
          <div className="section-block" style={{ marginTop: 12 }}>
            <div className="banner" role="region" aria-label={t('achievements.studyCardAria')}>
              <h3 style={{ marginBottom: 6 }}>
                {resolveKbText(activeCard.titleKey, undefined, lang)}
              </h3>
              <p>{resolveKbText(activeCard.summaryKey, undefined, lang)}</p>
              <p className="small-text" style={{ marginTop: 8 }}>
                {t('achievements.sourceLabel')}{' '}
                <a
                  href={activeCard.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {resolveKbText(activeCard.sourceKey, undefined, lang)}
                </a>
              </p>
            </div>

            <form className="form-stack" onSubmit={(e) => void handleSubmitQuiz(e)}>
              {activeCard.questions.map((q, qIdx) => {
                const fb = activeResult?.feedback[qIdx];
                return (
                  <fieldset
                    key={q.id}
                    className="card"
                    style={{ backgroundColor: 'var(--bg2)', margin: 0 }}
                  >
                    <legend style={{ fontWeight: 600, marginBottom: 8 }}>
                      {formatNum(qIdx + 1)}. {resolveKbText(q.questionKey, undefined, lang)}
                    </legend>
                    <div className="form-stack" style={{ gap: 8 }}>
                      {q.optionsKeys.map((optKey, optIdx) => (
                        <label
                          key={optKey}
                          className="toggle-row"
                          style={{ cursor: 'pointer', justifyContent: 'flex-start', gap: 10 }}
                        >
                          <input
                            type="radio"
                            name={`${activeCard.key}-${q.id}`}
                            checked={activeAnswers[qIdx] === optIdx}
                            onChange={() => handleSelectOption(qIdx, optIdx)}
                          />
                          <span>{resolveKbText(optKey, undefined, lang)}</span>
                        </label>
                      ))}
                    </div>
                    {fb && (
                      <div
                        className={fb.correct ? 'banner' : 'form-error'}
                        style={{
                          marginTop: 8,
                          borderColor: fb.correct ? 'var(--ok)' : 'var(--high)',
                        }}
                      >
                        <strong>
                          {fb.correct
                            ? t('achievements.answerCorrect')
                            : t('achievements.answerIncorrect')}
                        </strong>{' '}
                        — {resolveKbText(fb.explanationKey, undefined, lang)}
                      </div>
                    )}
                  </fieldset>
                );
              })}

              <div className="btn-row">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? t('achievements.checkingQuiz')
                    : t('achievements.submitQuizBtn')}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Earned & Locked Achievements Grid */}
      {authUser && (
        <>
          <section className="section-block" aria-labelledby="earned-heading">
            <div className="section-header">
              <h2 id="earned-heading">
                {t('achievements.earnedHeading', { count: formatNum(earnedItems.length) })}
              </h2>
            </div>
            {earnedItems.length === 0 ? (
              <div className="empty-state">
                <p>{t('achievements.noneEarnedYet')}</p>
              </div>
            ) : (
              <div className="card-grid">
                {earnedItems.map((item) => (
                  <article key={item.id} className="card">
                    <div className="metric-card-top">
                      <strong>{resolveKbText(item.titleKey, undefined, lang)}</strong>
                      <Badge label="COMPLETED" />
                    </div>
                    <p className="muted-text">
                      {resolveKbText(item.descriptionKey, undefined, lang)}
                    </p>
                    <div className="badge-row">
                      <Badge
                        label={`+${formatNum(item.points)} ${t('achievements.ptsShort')}`}
                        canonicalCode="NORMAL"
                      />
                      {item.unlockedAt && (
                        <span className="small-text tabular-nums">
                          <bdi dir="ltr">
                            {formatUtcIso(item.unlockedAt)} {t('app.utc')}
                          </bdi>
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="section-block" aria-labelledby="locked-heading">
            <div className="section-header">
              <h2 id="locked-heading">
                {t('achievements.lockedHeading', { count: formatNum(lockedItems.length) })}
              </h2>
            </div>
            {lockedItems.length === 0 ? (
              <div className="banner">
                <strong>{t('achievements.allUnlocked')}</strong>
              </div>
            ) : (
              <div className="card-grid">
                {lockedItems.map((item) => (
                  <article key={item.id} className="card">
                    <div className="metric-card-top">
                      <strong>{resolveKbText(item.titleKey, undefined, lang)}</strong>
                      <Badge label="PENDING" />
                    </div>
                    <p className="muted-text">
                      {resolveKbText(item.descriptionKey, undefined, lang)}
                    </p>
                    <p className="small-text">
                      <strong>{t('achievements.howToUnlock')}</strong>{' '}
                      {resolveKbText(item.unlockHintKey, undefined, lang)}
                    </p>
                    <div className="badge-row">
                      <Badge
                        label={`+${formatNum(item.points)} ${t('achievements.ptsShort')}`}
                        canonicalCode="INFORMATION"
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
