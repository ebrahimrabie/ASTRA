export const KB_EN_STRINGS: Record<string, string> = {
  // Mission templates
  'kb.templates.leo_iss.title': 'LEO Station (ISS-class)',
  'kb.templates.leo_iss.desc':
    'Orbital altitude ~400 km, ~92 min orbit (~16 sunrises/sunsets per day). GCR reference 1.3 mSv/day; typical ISS effective dose 0.2–0.5 mSv/day; typical badge absorbed dose < 0.3 mGy/day.',
  'kb.templates.lunar.title': 'Lunar Orbit / Lunar Surface',
  'kb.templates.lunar.desc':
    'Average Earth-Moon distance ~384,400 km (~1.28 s one-way light time, ~2.56 s round trip). Surface GCR reference 0.8 mSv/day; free-space GCR reference 1.3 mSv/day.',
  'kb.templates.mars.title': 'Mars Transit / Mars Surface',
  'kb.templates.mars.desc':
    'Earth-Mars distance varies roughly 54.6 million km to 401 million km (~3 to 22 minutes one-way light time). Default weekly entry carries forward the previously entered distance.',

  // Data Sources
  'kb.sources.std3001_v1.title': 'NASA-STD-3001 Volume 1: Crew Health',
  'kb.sources.std3001_v1.note': 'Human integration crew health & medical standards (radiation career limit 600 mSv, behavioral/sleep health context).',
  'kb.sources.std3001_v2.title': 'NASA-STD-3001 Volume 2: Human Factors, Habitability, and Environmental Health',
  'kb.sources.std3001_v2.note': 'Environmental requirements V2 6002–6013 (ppCO2, ppO2, cabin pressure, temperature/RH envelopes).',
  'kb.sources.tb002.title': 'NASA OCHMO Technical Brief TB-002: ECLSS Atmosphere',
  'kb.sources.tb002.note': 'Environmental Control and Life Support System atmosphere parameters and crew normoxia context.',
  'kb.sources.tb004.title': 'NASA OCHMO Technical Brief TB-004: Carbon Dioxide',
  'kb.sources.tb004.note': 'Links keeping 7-day average ppCO2 below 2.5 mmHg to <1% headache risk.',
  'kb.sources.tb020.title': 'NASA OCHMO Technical Brief TB-020: Space Radiation',
  'kb.sources.tb020.note': 'Radiation exposure context, shielding, and Solar Particle Event (SPE) operational practices.',
  'kb.sources.srag.title': 'NASA SRAG Radiation Detector Reference Pages',
  'kb.sources.srag.note': 'Roles of Crew Active Dosimeter (CAD), ISS-RAD alarm & trending, REM2, HERA, TEPC, and passive dosimeters.',
  'kb.sources.ntrs_exercise.title': 'NASA NTRS 20110016265: ISS Exercise Countermeasures',
  'kb.sources.ntrs_exercise.note': 'ISS reference countermeasure block: 2.5 hours/day, 6 days/week (1.5 h resistive + 1 h aerobic, 1 rest day).',
  'kb.sources.pmc_radiation.title': 'Space agency-specific standards for crew dose and risk assessment of ionising radiation exposures for the ISS',
  'kb.sources.pmc_radiation.note': 'International ISS radiation limit comparison, 30-day SPE reference (< 250 mSv), and Gy vs Sv distinction.',
  'kb.sources.acc_aha.title': 'ACC/AHA 2017 Guideline for High Blood Pressure in Adults',
  'kb.sources.acc_aha.note': 'Blood pressure categories (>=130/80, >=140/90, >180/120 mmHg) and standardized seated measurement protocol.',
  'kb.sources.aasm_srs.title': 'AASM/SRS 2015 Joint Consensus Statement on Adult Sleep Duration',
  'kb.sources.aasm_srs.note': 'Adults should sleep 7 or more hours per night on a regular basis.',

  // Instruments
  'kb.instruments.cad.name': 'Crew Active Dosimeter (CAD)',
  'kb.instruments.cad.desc': 'Personal active dosimeter showing total mission dose and recent dose rate.',
  'kb.instruments.iss_rad.name': 'ISS-RAD (Radiation Assessment Detector)',
  'kb.instruments.iss_rad.desc': 'Active monitor with alarm role for crew shelter decisions and trending role.',
  'kb.instruments.rem2.name': 'REM2 (Timepix Radiation Environment Monitor)',
  'kb.instruments.rem2.desc': 'Timepix-based active radiation environment spectrometer.',
  'kb.instruments.hera.name': 'HERA (Hybrid Electronic Radiation Assessor)',
  'kb.instruments.hera.desc': 'Orion/Gateway hybrid electronic radiation assessor.',
  'kb.instruments.tepc.name': 'Tissue Equivalent Proportional Counter (TEPC)',
  'kb.instruments.tepc.desc': 'Microdosimetric instrument measuring absorbed dose and LET spectrum.',
  'kb.instruments.passive.name': 'Passive crew dosimeter',
  'kb.instruments.passive.desc': 'Cumulative passive badge dosimeter read post-mission.',
  'kb.instruments.crew_medical.name': 'Crew medical device (approved)',
  'kb.instruments.crew_medical.desc': 'Mission-approved crew medical measurement instrument.',
  'kb.instruments.manual.name': 'Manual measurement',
  'kb.instruments.manual.desc': 'Direct manual measurement by crew or operator.',
  'kb.instruments.wearable.name': 'Wearable',
  'kb.instruments.wearable.desc': 'Approved crew wearable sensor.',
  'kb.instruments.vehicle_atmo.name': 'Vehicle atmosphere monitor display',
  'kb.instruments.vehicle_atmo.desc': 'Primary spacecraft cabin atmosphere monitor display.',
  'kb.instruments.portable_gas.name': 'Portable gas analyzer',
  'kb.instruments.portable_gas.desc': 'Handheld / portable cabin gas analyzer.',
  'kb.instruments.mission_uplink.name': 'Mission control uplink',
  'kb.instruments.mission_uplink.desc': 'Ground mission control ranging & link telemetry.',
  'kb.instruments.onboard_nav.name': 'Onboard navigation display',
  'kb.instruments.onboard_nav.desc': 'Spacecraft onboard navigation state display.',
  'kb.instruments.template_default.name': 'Template default',
  'kb.instruments.template_default.desc': 'Pre-entry default physical distance from mission template.',
  'kb.instruments.other.name': 'Other (type it)',
  'kb.instruments.other.desc': 'Enter specific device or instrument name.',

  // Rules
  'kb.rules.R-RAD-01.title': 'Absorbed Dose Rate Above Typical LEO Range',
  'kb.rules.R-RAD-01.explanation': 'Absorbed dose rate exceeds 0.4 mGy/day, which is above the typical LEO crew badge range (< 0.3 mGy/day).',
  'kb.rules.R-RAD-01.next_step': 'Confirm detector reading and location, compare with a second instrument if available, and record the source.',
  'kb.rules.R-RAD-01.source': 'NASA SRAG / LEO Dosimetry Context',

  'kb.rules.R-RAD-02.title': 'Radiation Dose Margin Reached 50%',
  'kb.rules.R-RAD-02.explanation': 'Career effective dose >= 50% of 600 mSv or trailing 30-day effective dose >= 50% of 250 mSv.',
  'kb.rules.R-RAD-02.next_step': 'Continue scheduled weekly dosimetry logging and review exposure trends with mission planning.',
  'kb.rules.R-RAD-02.source': 'Prototype margin on NASA-STD-3001 600 mSv career / 250 mSv 30-day references',

  'kb.rules.R-RAD-03.title': 'Radiation Dose Margin Reached 80%',
  'kb.rules.R-RAD-03.explanation': 'Career effective dose >= 80% of 600 mSv or trailing 30-day effective dose >= 80% of 250 mSv.',
  'kb.rules.R-RAD-03.next_step': 'Notify the Doctor and mission support; follow the mission ALARA procedures.',
  'kb.rules.R-RAD-03.source': 'Prototype margin on NASA-STD-3001 600 mSv career / 250 mSv 30-day references',

  'kb.rules.R-RAD-04.title': 'NASA Effective Dose Reference Reached',
  'kb.rules.R-RAD-04.explanation': 'Career effective dose >= 600 mSv universal limit or trailing 30-day effective dose >= 250 mSv reference.',
  'kb.rules.R-RAD-04.next_step': 'Immediately notify mission support and Flight Surgeon / Doctor; execute approved dose-limit operational procedures.',
  'kb.rules.R-RAD-04.source': 'NASA-STD-3001 Vol 1 (600 mSv career limit) & ISS 30-day SPE reference (250 mSv)',

  'kb.rules.R-RAD-05.title': 'Solar Particle Event (SPE) In Progress',
  'kb.rules.R-RAD-05.explanation': 'Commander logged Solar Event Status = SPE in progress.',
  'kb.rules.R-RAD-05.next_step': 'Follow the mission approved solar particle event contingency procedures (shielding/shelter plan) and contact mission support.',
  'kb.rules.R-RAD-05.source': 'NASA OCHMO TB-020 / NASA SRAG ISS-RAD Shelter Operations',

  'kb.rules.R-ENV-01.title': 'Verified 1-Hour Average ppCO2 Exceeds 3 mmHg',
  'kb.rules.R-ENV-01.explanation': 'Verified rolling 1-hour average (>= 5 samples, >= 60 min span, max gap <= 20 min) exceeds NASA-STD-3001 [V2 6004] 3.0 mmHg criterion.',
  'kb.rules.R-ENV-01.next_step': 'Check ventilation and CO2 removal status on the approved vehicle displays, re-sample, notify mission support; crew reporting symptoms should contact the Doctor.',
  'kb.rules.R-ENV-01.source': 'NASA-STD-3001 Vol 2 [V2 6004]',

  'kb.rules.R-ENV-02.title': 'Single ppCO2 Sample Above 3 mmHg (Coverage Incomplete)',
  'kb.rules.R-ENV-02.explanation': 'A single ppCO2 sample exceeds 3.0 mmHg while 1-hour sampling coverage is not yet verified.',
  'kb.rules.R-ENV-02.next_step': 'Single sample above 3 mmHg; the one-hour average cannot be verified yet. Continue sampling every 15 minutes until coverage >= 60 minutes.',
  'kb.rules.R-ENV-02.source': 'NASA-STD-3001 Vol 2 [V2 6004] Sampling Protocol',

  'kb.rules.R-ENV-03.title': '7-Day Average ppCO2 Above 2.5 mmHg',
  'kb.rules.R-ENV-03.explanation': '7-day mean ppCO2 exceeds 2.5 mmHg; NASA OCHMO TB-004 links keeping the 7-day average below 2.5 mmHg to <1% headache risk.',
  'kb.rules.R-ENV-03.next_step': 'Review scrubber performance trending on approved vehicle displays and continue scheduled sampling.',
  'kb.rules.R-ENV-03.source': 'NASA OCHMO Technical Brief TB-004',

  'kb.rules.R-ENV-04.title': 'Cabin ppO2 Outside Normoxia Target Range',
  'kb.rules.R-ENV-04.explanation': 'Oxygen partial pressure is outside the NASA normoxia target range of 145 to 155 mmHg.',
  'kb.rules.R-ENV-04.next_step': 'Verify the sensor reading, check atmosphere control status on vehicle displays, and notify mission support.',
  'kb.rules.R-ENV-04.source': 'NASA-STD-3001 Vol 2 [V2 6003]',

  'kb.rules.R-ENV-05.title': 'Total Pressure or Diluent Gas Outside Limits',
  'kb.rules.R-ENV-05.explanation': 'Total cabin pressure is outside 34.5–103 kPa or diluent gas fraction is below 30%.',
  'kb.rules.R-ENV-05.next_step': 'Immediately verify approved cabin pressure displays, inspect seals/atmosphere supply status, and notify mission support.',
  'kb.rules.R-ENV-05.source': 'NASA-STD-3001 Vol 2 [V2 6002 / V2 6006]',

  'kb.rules.R-ENV-06.title': 'Temperature or Relative Humidity Outside Envelope',
  'kb.rules.R-ENV-06.explanation': 'Cabin temperature/humidity is outside crew performance zone (20–25 C, 30–60% RH) or outside crew health limits (18 C/75% RH to 27 C/25% RH).',
  'kb.rules.R-ENV-06.next_step': 'Check cabin thermal control status on approved displays, verify sensor accuracy, and notify mission support if outside health limits.',
  'kb.rules.R-ENV-06.source': 'NASA-STD-3001 Vol 2 [V2 6012 / V2 6013]',

  'kb.rules.R-ENV-07.title': 'Cabin Ventilation Degraded or Off',
  'kb.rules.R-ENV-07.explanation': 'Commander logged cabin ventilation status as Degraded or Off.',
  'kb.rules.R-ENV-07.next_step': 'Confirm airflow status on approved vehicle displays, monitor ppCO2 closely, and follow mission ventilation contingency procedures.',
  'kb.rules.R-ENV-07.source': 'Prototype operational rule / ECLSS ventilation context',

  'kb.rules.R-GRV-01.title': 'Weekly Exercise Days Below NASA 6-Day Reference',
  'kb.rules.R-GRV-01.explanation': 'Mission weekly exercise schedule logged fewer than 6 days against NASA ISS reference (2.5-hour blocks 6 days/week, 1 rest day).',
  'kb.rules.R-GRV-01.next_step': 'Operational note only: review equipment availability and crew schedule flexibility without ranking or comparing individuals.',
  'kb.rules.R-GRV-01.source': 'NASA NTRS 20110016265',

  'kb.rules.R-ISO-01.title': 'Extended Interval Since Last Ground Contact',
  'kb.rules.R-ISO-01.explanation': 'More than 7 days recorded since the last scheduled ground-contact session.',
  'kb.rules.R-ISO-01.next_step': 'Note communication cadence in mission log and verify upcoming ground-support contact schedule.',
  'kb.rules.R-ISO-01.source': 'Prototype operational rule / Behavioral health context',

  'kb.rules.R-DST-01.title': 'Spacecraft Communication Link Degraded',
  'kb.rules.R-DST-01.explanation': 'Commander recorded communication link status as Degraded.',
  'kb.rules.R-DST-01.next_step': 'Verify antenna/link telemetry and prepare offline protocols if delay or bandwidth worsens.',
  'kb.rules.R-DST-01.source': 'Prototype operational rule',

  'kb.rules.R-DST-02.title': 'Loss of Signal (Communication Link)',
  'kb.rules.R-DST-02.explanation': 'Commander recorded Loss of Signal on the Earth-spacecraft link.',
  'kb.rules.R-DST-02.next_step': 'Follow the mission communication-loss procedures; use locally stored protocols; ASTRA keeps working offline and queues entries.',
  'kb.rules.R-DST-02.source': 'Prototype communication-loss contingency rule',

  'kb.rules.R-HR-01.title': 'Resting Heart Rate Outside 60–100 bpm',
  'kb.rules.R-HR-01.explanation': 'Resting heart rate reading is below 60 bpm or above 100 bpm (applied strictly to Resting context).',
  'kb.rules.R-HR-01.next_step': 'Re-measure after 5 minutes of quiet rest using the same approved device, then record the repeat measurement.',
  'kb.rules.R-HR-01.source': 'General published clinical adult resting HR reference (60–100 bpm)',

  'kb.rules.R-HR-02.title': 'Consecutive Days Outside Resting Heart Rate Reference',
  'kb.rules.R-HR-02.explanation': 'Two resting heart rate readings outside 60–100 bpm recorded on consecutive UTC days.',
  'kb.rules.R-HR-02.next_step': 'Follow repeat measurement protocol and contact the designated Doctor for procedural review.',
  'kb.rules.R-HR-02.source': 'Prototype consecutive-day monitoring rule',

  'kb.rules.R-BP-01.title': 'Blood Pressure Elevated / Stage 1 Reference (>=130/80 mmHg)',
  'kb.rules.R-BP-01.explanation': 'Systolic >= 130 mmHg or diastolic >= 80 mmHg per ACC/AHA 2017 categories.',
  'kb.rules.R-BP-01.next_step': 'Follow BP measurement protocol (seated/relaxed 5 minutes, arm at heart level, two readings 1 minute apart) and re-record.',
  'kb.rules.R-BP-01.source': 'ACC/AHA 2017 High Blood Pressure Guideline',

  'kb.rules.R-BP-02.title': 'Blood Pressure Stage 2 Reference (>=140/90 mmHg)',
  'kb.rules.R-BP-02.explanation': 'Systolic >= 140 mmHg or diastolic >= 90 mmHg per ACC/AHA 2017 categories.',
  'kb.rules.R-BP-02.next_step': 'Repeat reading after 5 minutes of quiet rest (two readings 1 minute apart) and contact the Doctor for review.',
  'kb.rules.R-BP-02.source': 'ACC/AHA 2017 High Blood Pressure Guideline',

  'kb.rules.R-BP-03.title': 'Blood Pressure High-Priority Threshold (>180/120 mmHg)',
  'kb.rules.R-BP-03.explanation': 'Systolic > 180 mmHg or diastolic > 120 mmHg.',
  'kb.rules.R-BP-03.next_step': 'Follow BP measurement protocol immediately, repeat the reading to rule out artifact, and contact the Doctor immediately.',
  'kb.rules.R-BP-03.source': 'ACC/AHA 2017 High Blood Pressure Guideline',

  'kb.rules.R-BP-04.title': 'Low Blood Pressure Reference (<90/60 mmHg)',
  'kb.rules.R-BP-04.explanation': 'Systolic < 90 mmHg or diastolic < 60 mmHg.',
  'kb.rules.R-BP-04.next_step': 'Repeat reading after 5 minutes of quiet rest, verify cuff placement at heart level, and notify the Doctor if persistent or symptomatic.',
  'kb.rules.R-BP-04.source': 'General published clinical reference',

  'kb.rules.R-SLP-01.title': 'Sleep Duration Below 7.0 Hours',
  'kb.rules.R-SLP-01.explanation': 'Recorded sleep duration is below the 7.0-hour adult consensus minimum (NASA schedules 8.5 hours).',
  'kb.rules.R-SLP-01.next_step': 'Review rest schedule and lighting routine per mission guidelines; log upcoming sleep period on waking.',
  'kb.rules.R-SLP-01.source': 'AASM/SRS 2015 Consensus Statement & NASA-STD-3001 (8.5 h schedule)',

  'kb.rules.R-SLP-02.title': 'Three Consecutive Nights Below 7.0 Hours',
  'kb.rules.R-SLP-02.explanation': 'Three consecutive sleep entries are below 7.0 hours.',
  'kb.rules.R-SLP-02.next_step': 'Doctor notified for procedural schedule review. Continue recording morning sleep hours.',
  'kb.rules.R-SLP-02.source': 'Prototype consecutive-night rule on AASM/SRS 7.0 h threshold',

  'kb.rules.R-SLP-03.title': 'Downward Sleep Duration Trend (>=3 Decreasing Steps)',
  'kb.rules.R-SLP-03.explanation': 'Three or more consecutive decreasing sleep duration steps detected across stored nights.',
  'kb.rules.R-SLP-03.next_step': 'Informational trend notice: continue logging daily sleep duration upon waking.',
  'kb.rules.R-SLP-03.source': 'Prototype trend detection rule',

  'kb.rules.R-MOOD-01.title': 'Consecutive Very Low Self-Reported Mood',
  'kb.rules.R-MOOD-01.explanation': 'Mood level 1 (Very low) recorded on two consecutive entries. Shared privately with Doctor only.',
  'kb.rules.R-MOOD-01.next_step': 'Private Doctor check-in recommended per mission behavioral health procedures.',
  'kb.rules.R-MOOD-01.source': 'Self-report scale, prototype instrument v1',

  'kb.rules.R-STR-01.title': 'Elevated Daily Stress Rating (>=70/100)',
  'kb.rules.R-STR-01.explanation': 'Daily stress self-rating reached 70/100 or higher. Shared privately with Doctor only.',
  'kb.rules.R-STR-01.next_step': 'Note operational workload context and repeat scheduled daily self-check.',
  'kb.rules.R-STR-01.source': 'Self-report scale, prototype instrument v1',

  'kb.rules.R-STR-02.title': 'Three Consecutive Days of Stress >= 70/100',
  'kb.rules.R-STR-02.explanation': 'Self-reported stress >= 70/100 on three consecutive entries. Shared privately with Doctor only.',
  'kb.rules.R-STR-02.next_step': 'Doctor notified privately for confidential procedural support review.',
  'kb.rules.R-STR-02.source': 'Self-report scale, prototype instrument v1',

  'kb.rules.R-ACT-01.title': 'Weekly Exercise Below NASA Reference Schedule',
  'kb.rules.R-ACT-01.explanation': 'Logged exercise days this week are fewer than the NASA ISS reference of 6 days/week (1.5 h resistive + 1 h aerobic).',
  'kb.rules.R-ACT-01.next_step': 'Neutral operational note only (rest days are part of the reference); log completed sessions.',
  'kb.rules.R-ACT-01.source': 'NASA NTRS 20110016265',

  'kb.rules.R-DATA-01.title': 'Two Consecutive Days Without Daily Entries',
  'kb.rules.R-DATA-01.explanation': 'Crew member has two consecutive UTC days with no daily health entries.',
  'kb.rules.R-DATA-01.next_step': 'Verify device sync or connectivity status and resume scheduled daily logging.',
  'kb.rules.R-DATA-01.source': 'Prototype data-completeness rule',

  'kb.rules.R-DATA-02.title': 'Weekly Hazard Entry Overdue',
  'kb.rules.R-DATA-02.explanation': 'Weekly mission hazard assessment is overdue by 1 day or more.',
  'kb.rules.R-DATA-02.next_step': 'Open Mission Risks or Calendar to enter the weekly Commander hazard log with instrument & UTC timestamp.',
  'kb.rules.R-DATA-02.source': 'Prototype data-completeness rule',

  'kb.rules.R-REP-01.title': 'Crew Problem Report Submitted',
  'kb.rules.R-REP-01.explanation': 'A crew member submitted a manual problem report for Doctor review.',
  'kb.rules.R-REP-01.next_step': 'Doctor reviews the verbatim report text and contacts the crew member via approved mission channels.',
  'kb.rules.R-REP-01.source': 'Manual crew problem report',

  // Protocols
  'kb.protocols.PRT-HR.title': 'Resting Heart Rate Protocol',
  'kb.protocols.PRT-HR.purpose': 'Capture standardized resting heart rate with context and approved instrument.',
  'kb.protocols.PRT-HR.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-HR.step1': 'Sit or float quietly relaxed for 5 minutes before measurement.',
  'kb.protocols.PRT-HR.step2': 'Use the approved crew medical device or wearable.',
  'kb.protocols.PRT-HR.step3': 'Record beats per minute (bpm) and select context (Resting / After exercise / Other).',
  'kb.protocols.PRT-HR.step4': 'Verify and record the UTC measurement timestamp.',

  'kb.protocols.PRT-BP.title': 'Blood Pressure Protocol',
  'kb.protocols.PRT-BP.purpose': 'Measure systolic and diastolic blood pressure under standardized resting conditions.',
  'kb.protocols.PRT-BP.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-BP.step1': 'Rest quietly for 5 minutes before taking a reading.',
  'kb.protocols.PRT-BP.step2': 'Keep the cuffed arm supported at heart level.',
  'kb.protocols.PRT-BP.step3': 'Take two readings 1 minute apart and record the average or confirmed values.',
  'kb.protocols.PRT-BP.step4': 'Note the approved device ID and UTC measurement time.',

  'kb.protocols.PRT-SLP.title': 'Morning Sleep Duration Log',
  'kb.protocols.PRT-SLP.purpose': 'Log total nightly sleep duration upon waking (NASA schedules 8.5 h; adult consensus >= 7 h).',
  'kb.protocols.PRT-SLP.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-SLP.step1': 'Record total sleep hours shortly after waking.',
  'kb.protocols.PRT-SLP.step2': 'Optionally record sleep start and end UTC times and source.',

  'kb.protocols.PRT-MOOD.title': 'Daily Mood Self-Check',
  'kb.protocols.PRT-MOOD.purpose': 'Private self-report check-in (never shared with Commander or compared between crew).',
  'kb.protocols.PRT-MOOD.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-MOOD.step1': 'Select the 1–5 mood level that best fits today (1 = Very low, 5 = Very good).',
  'kb.protocols.PRT-MOOD.step2': 'Confirm UTC timestamp; entry remains strictly private.',

  'kb.protocols.PRT-STR.title': 'Daily Stress Rating',
  'kb.protocols.PRT-STR.purpose': 'Private 0–100 self-rating scale (prototype instrument v1).',
  'kb.protocols.PRT-STR.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-STR.step1': 'Enter a 0 to 100 self-rating reflecting current perceived stress.',
  'kb.protocols.PRT-STR.step2': 'Confirm UTC timestamp; entry stays private to you and the Doctor.',

  'kb.protocols.PRT-ACT.title': 'Countermeasure Exercise Log',
  'kb.protocols.PRT-ACT.purpose': 'Log exercise sessions against the NASA ISS 2.5 h/day, 6 days/week countermeasure schedule.',
  'kb.protocols.PRT-ACT.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-ACT.step1': 'Select session type (Resistive / Aerobic / Other) and duration in minutes.',
  'kb.protocols.PRT-ACT.step2': 'Mark completion status and record UTC timestamp.',

  'kb.protocols.PRT-RAD.title': 'Weekly Radiation Dosimetry Protocol',
  'kb.protocols.PRT-RAD.purpose': 'Record absorbed (mGy) and effective (mSv) radiation doses separately from approved dosimeters.',
  'kb.protocols.PRT-RAD.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-RAD.step1': 'Read total mission dose and recent dose rate from CAD and active monitor (ISS-RAD or equivalent).',
  'kb.protocols.PRT-RAD.step2': 'Enter absorbed dose (mGy) and effective dose (mSv) in separate fields without conversion.',
  'kb.protocols.PRT-RAD.step3': 'Note detector location/module, solar particle event status, and UTC timestamps.',

  'kb.protocols.PRT-ENV.title': 'Weekly Cabin Atmosphere Sampling Protocol',
  'kb.protocols.PRT-ENV.purpose': 'Verify 1-hour rolling ppCO2 average (>=5 samples, >=60 min span, max gap <=20 min) plus ppO2, pressure, temp/RH.',
  'kb.protocols.PRT-ENV.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-ENV.step1': 'Take ppCO2 readings every 15 minutes over at least 75 minutes (minimum 5 samples spanning >= 60 minutes).',
  'kb.protocols.PRT-ENV.step2': 'Enter ppO2 (mmHg), total pressure (kPa), diluent %, temperature (C), RH %, and ventilation status.',

  'kb.protocols.PRT-GRV.title': 'Weekly Altered Gravity & Countermeasure Review',
  'kb.protocols.PRT-GRV.purpose': 'Log mission gravity state and weekly exercise countermeasure day counts.',
  'kb.protocols.PRT-GRV.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-GRV.step1': 'Record current gravity environment (e.g., Microgravity, Lunar 0.165g, Mars 0.38g).',
  'kb.protocols.PRT-GRV.step2': 'Enter weekly scheduled exercise days completed (target 6 days/week with 1 rest day).',

  'kb.protocols.PRT-ISO.title': 'Weekly Isolation & Ground Contact Log',
  'kb.protocols.PRT-ISO.purpose': 'Track ground-contact sessions and aggregate crew check-in participation without exposing individual psych data.',
  'kb.protocols.PRT-ISO.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-ISO.step1': 'Record number of ground-contact sessions completed this week.',
  'kb.protocols.PRT-ISO.step2': 'Record days elapsed since last successful ground contact.',

  'kb.protocols.PRT-DST.title': 'Weekly Distance & Communication Link Status',
  'kb.protocols.PRT-DST.purpose': 'Update spacecraft Earth distance (km) and link status to compute one-way and round-trip light time.',
  'kb.protocols.PRT-DST.safety': 'Prototype default protocol. Adapt to the devices and procedures approved for your mission.',
  'kb.protocols.PRT-DST.step1': 'Read spacecraft-Earth distance (km) from Mission control uplink or Onboard navigation display.',
  'kb.protocols.PRT-DST.step2': 'Record current communication status (Nominal / Degraded / Loss of signal).',

  // Alert dynamic titles
  'alerts.titles.R-HR-01': 'Resting heart rate outside 60–100 bpm ({value} {unit})',
  'alerts.titles.R-HR-02': 'Consecutive-day resting HR outside 60–100 bpm ({value} {unit})',
  'alerts.titles.R-BP-01': 'Elevated blood pressure reference ({systolic}/{diastolic} {unit})',
  'alerts.titles.R-BP-02': 'Stage 2 blood pressure reference ({systolic}/{diastolic} {unit})',
  'alerts.titles.R-BP-03': 'HIGH PRIORITY blood pressure (>180/120 mmHg): {systolic}/{diastolic} {unit}',
  'alerts.titles.R-BP-04': 'Low blood pressure reference ({systolic}/{diastolic} {unit})',
  'alerts.titles.R-SLP-01': 'Sleep below 7.0 h clinical reference ({hours} {unit})',
  'alerts.titles.R-SLP-02': 'Three consecutive nights below 7.0 h (latest {hours} {unit})',
  'alerts.titles.R-SLP-03': 'Downward sleep trend over {steps} consecutive steps ({hours} {unit})',
  'alerts.titles.R-MOOD-01': 'Very low mood reported for {days} consecutive days (private)',
  'alerts.titles.R-STR-01': 'Stress rating >= 70/100 ({score} {unit})',
  'alerts.titles.R-STR-02': 'Stress >= 70/100 for {days} consecutive days ({score} {unit})',
  'alerts.titles.R-ACT-01': 'Weekly exercise below NASA 6-day reference ({days}/{target} days)',
  'alerts.titles.R-RAD-01': 'Absorbed dose rate > 0.4 mGy/day ({value} {unit})',
  'alerts.titles.R-RAD-02': 'Radiation dose margin reached >= 50% ({percent}%)',
  'alerts.titles.R-RAD-03': 'Radiation dose margin reached >= 80% ({percent}%)',
  'alerts.titles.R-RAD-04': 'NASA radiation effective dose limit reached ({careerMsv} mSv career / {day30Msv} mSv 30d)',
  'alerts.titles.R-RAD-05': 'HIGH PRIORITY: Solar Particle Event (SPE) in progress',
  'alerts.titles.R-RAD-05.doctor_info': 'INFORMATION notice: Solar Particle Event (SPE) in progress (Commander notified)',
  'alerts.titles.R-ENV-01': 'ALERT: Verified 1-hour average ppCO2 > 3.0 mmHg ({value} {unit})',
  'alerts.titles.R-ENV-02': 'Single ppCO2 sample > 3.0 mmHg ({value} {unit}; 1-hour average unverified)',
  'alerts.titles.R-ENV-03': '7-day mean ppCO2 > 2.5 mmHg ({value} {unit})',
  'alerts.titles.R-ENV-04': 'Cabin ppO2 outside 145–155 mmHg ({value} {unit})',
  'alerts.titles.R-ENV-05': 'Cabin pressure or diluent outside NASA limits ({pressure} kPa / {diluent}%)',
  'alerts.titles.R-ENV-06.info': 'Temp/RH outside performance zone ({tempC} C, {rhPercent}% RH) but within health limits',
  'alerts.titles.R-ENV-06.alert': 'ALERT: Temp/RH outside crew health limits ({tempC} C, {rhPercent}% RH)',
  'alerts.titles.R-ENV-07': 'Cabin ventilation status: {status}',
  'alerts.titles.R-GRV-01': 'Weekly exercise days ({days}/{target}) below NASA 6-day reference',
  'alerts.titles.R-ISO-01': 'Ground contact interval > 7 days ({days} days)',
  'alerts.titles.R-DST-01': 'Communication link Degraded',
  'alerts.titles.R-DST-02': 'ALERT: Loss of signal on communication link',
  'alerts.titles.R-REP-01.standard': 'Crew problem report from {subjectName}',
  'alerts.titles.R-REP-01.urgent': 'URGENT crew problem report from {subjectName}',
};

import { translateText, type LocaleLanguage } from './index';

export function resolveKbText(
  key: string,
  params?: Record<string, unknown>,
  lang?: LocaleLanguage
): string {
  const effectiveLang: LocaleLanguage =
    lang ??
    (typeof document !== 'undefined' && document.documentElement?.lang === 'ar'
      ? 'ar'
      : 'en');
  return translateText(effectiveLang, key, params);
}
