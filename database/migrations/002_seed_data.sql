-- ============================================================
-- CRI Platform - Seed Data
-- Cultural benchmarks derived from Hofstede 6-D research
-- ============================================================

-- ============================================================
-- BENCHMARK DATA (Hofstede-derived, normalized to 0-100 scale)
-- ============================================================

INSERT INTO benchmarks (country, industry, power_distance, individualism_collectivism, masculinity_femininity, uncertainty_avoidance, long_term_orientation, indulgence_restraint, communication_style, hofstede_pdi, hofstede_idv, hofstede_mas, hofstede_uai, hofstede_lto, hofstede_ind, notes) VALUES

-- Nigeria benchmarks
('Nigeria', 'Technology',
  75,   -- PD: High hierarchy (national 80), tech slightly lower
  35,   -- IC: Collectivist (national 30), tech slightly more individual
  65,   -- MF: Achievement-driven (national 60)
  55,   -- UA: Moderate (national 55)
  16,   -- LTO: Short-term (national 13)
  84,   -- IR: Highly indulgent (national 84)
  70,   -- CS: Indirect communication
  80, 30, 60, 55, 13, 84,
  'Nigeria Tech sector: High PD respected, moderate collectivism, competitive and achievement-driven. Collectivism slightly lower than national avg due to individual career focus in tech startups.'
),

('Nigeria', 'Finance',
  85,   -- PD: Very hierarchical (stricter than tech)
  30,   -- IC: Very collectivist  
  70,   -- MF: Highly competitive
  65,   -- UA: Higher in regulated finance
  15,   -- LTO: Short-term focused
  75,   -- IR: Indulgent but with corporate restraint
  78,   -- CS: Highly indirect, face-saving
  80, 30, 60, 55, 13, 84,
  'Nigeria Finance sector: More hierarchical than tech, highly regulated environment drives higher uncertainty avoidance.'
),

('Nigeria', 'Healthcare',
  78, 28, 55, 60, 14, 72, 68,
  80, 30, 60, 55, 13, 84,
  'Nigeria Healthcare: High hierarchy, strong collectivism, moderate achievement orientation.'
),

('Nigeria', 'Manufacturing',
  82, 25, 68, 58, 12, 70, 72,
  80, 30, 60, 55, 13, 84,
  'Nigeria Manufacturing: Traditional hierarchy, very collectivist teams.'
),

('Nigeria', 'General',
  80, 30, 60, 55, 13, 84, 70,
  80, 30, 60, 55, 13, 84,
  'Nigeria national average (Hofstede 6-D scores). PD=80 (high hierarchy - benevolent autocrat leadership expected). IDV=30 (collectivist - group loyalty paramount). MAS=60 (masculine - achievement driven). UAI=55 (moderate uncertainty avoidance). LTO=13 (short-term normative). IND=84 (highly indulgent).'
),

-- South Africa benchmarks
('South Africa', 'Technology',
  50, 65, 63, 49, 34, 63, 35,
  49, 65, 63, 49, 34, 63,
  'South Africa Tech: Moderate hierarchy, more individualistic, Ubuntu philosophy creates consultative decision-making. Direct communication common but face-saving still important.'
),

('South Africa', 'Finance',
  52, 60, 65, 52, 32, 60, 40,
  49, 65, 63, 49, 34, 63,
  'South Africa Finance: Slightly more hierarchical, competitive. Mix of Western and Ubuntu business practices.'
),

('South Africa', 'General',
  49, 65, 63, 49, 34, 63, 38,
  49, 65, 63, 49, 34, 63,
  'South Africa national average. Rainbow nation with complex cultural mix. Individualistic but Ubuntu philosophy creates collectivist tendencies. Direct communication common. Moderate hierarchy.'
),

-- Kenya benchmarks  
('Kenya', 'Technology',
  68, 28, 58, 48, 28, 55, 62,
  70, 25, 60, 50, 25, NULL,
  'Kenya Tech: High Power Distance, collectivist Harambee spirit, achievement-driven, indirect communication to maintain harmony.'
),

('Kenya', 'Telecommunications',
  70, 25, 60, 50, 25, 55, 65,
  70, 25, 60, 50, 25, NULL,
  'Kenya Telecoms: Mirrors national culture closely. Relationship-first business approach. Harambee collective spirit.'
),

('Kenya', 'General',
  70, 25, 60, 50, 25, 50, 63,
  70, 25, 60, 50, 25, NULL,
  'Kenya national profile. Relationship-driven, collectivist, hierarchical. Harambee spirit. Indirect polite communication. Short-term orientation.'
),

-- Ghana benchmarks
('Ghana', 'Technology',
  78, 18, 42, 62, 6, 70, 75,
  80, 15, 40, 65, 4, 72,
  'Ghana Tech: Very hierarchical (PD=80), very collectivist (IDV=15). Top-down innovation. Indulgent social work environment. Fluid deadline perception. Indirect face-saving communication.'
),

('Ghana', 'Finance',
  82, 15, 45, 68, 5, 68, 78,
  80, 15, 40, 65, 4, 72,
  'Ghana Finance: Most hierarchical sector. Strict adherence to seniority. High uncertainty avoidance in regulated environment.'
),

('Ghana', 'General',
  80, 15, 40, 65, 4, 72, 75,
  80, 15, 40, 65, 4, 72,
  'Ghana national profile. Highly hierarchical (PD=80) and collectivist (IDV=15). Very short-term orientation (LTO=4). High indulgence (IND=72). Indirect communication, face-saving critical.'
),

-- Egypt benchmarks
('Egypt', 'Technology',
  68, 28, 45, 78, 8, 6, 72,
  70, 25, 45, 80, 7, 4,
  'Egypt Tech: Hierarchical, relationship-based, very high uncertainty avoidance (need for clear rules). Face concept critical. Very restrained culture (IND=4).'
),

('Egypt', 'General',
  70, 25, 45, 80, 7, 4, 70,
  70, 25, 45, 80, 7, 4,
  'Egypt national profile. High PD, collectivist, very high UAI (rigid rules, intolerance of ambiguity). Highly restrained society (IND=4). Face concept critical, avoid direct confrontation.'
),

-- Ethiopia benchmarks
('Ethiopia', 'Technology',
  68, 22, 62, 52, 28, 44, 75,
  70, 20, 65, 55, 25, 46,
  'Ethiopia Tech: Formal hierarchy, age/seniority respected, collectivist, achievement-oriented. Highly indirect communication, patience essential.'
),

('Ethiopia', 'General',
  70, 20, 65, 55, 25, 46, 75,
  70, 20, 65, 55, 25, 46,
  'Ethiopia national profile. Formal, hierarchical, collectivist. Masculine achievement society. Highly indirect communication. Patience and relationship-building prerequisite for business.'
);

-- ============================================================
-- QUESTION BANK stored as reference (JSON format)
-- The full question bank is also embedded in the MCP server
-- This is a reference/lookup table
-- ============================================================

CREATE TABLE IF NOT EXISTS question_bank (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country      VARCHAR(100) NOT NULL,
  version      VARCHAR(10) NOT NULL DEFAULT '1.2',
  dimension_id VARCHAR(50) NOT NULL,
  question_id  VARCHAR(10) NOT NULL,
  question_text TEXT NOT NULL,
  scoring_type VARCHAR(10) NOT NULL CHECK (scoring_type IN ('direct','inverse')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country, question_id)
);

-- Nigeria Question Bank (7 dimensions, 24 questions)
INSERT INTO question_bank (country, version, dimension_id, question_id, question_text, scoring_type) VALUES

-- Dimension 1: Hierarchy & Authority (Power Distance) - Nigeria PD score: 80
('Nigeria','1.2','power_distance','PD1','Decisions made by senior leaders should be implemented without being questioned by junior team members.','direct'),
('Nigeria','1.2','power_distance','PD2','It is important to address senior colleagues by their formal titles (e.g., Mr., Mrs., Dr.) to show respect.','direct'),
('Nigeria','1.2','power_distance','PD3','Directly challenging a manager''s idea in a team meeting is a sign of disrespect.','direct'),
('Nigeria','1.2','power_distance','PD4','The best managers give their team precise instructions on what to do and how to do it.','direct'),

-- Dimension 2: Team & Community Orientation (Individualism-Collectivism) - Nigeria IDV: 30 (collectivist)
('Nigeria','1.2','individualism_collectivism','IC1','The success of the team as a whole is more important than any individual''s recognition.','direct'),
('Nigeria','1.2','individualism_collectivism','IC2','Building strong personal relationships with colleagues by inquiring about their family and well-being is essential for getting work done effectively.','direct'),
('Nigeria','1.2','individualism_collectivism','IC3','Publicly celebrating the team''s success is more effective than publicly praising one individual.','direct'),
('Nigeria','1.2','individualism_collectivism','IC4','A company should show concern for an employee''s well-being outside of work, like a family.','direct'),

-- Dimension 3: Drive for Achievement vs. Quality of Life (Masculinity) - Nigeria MAS: 60
('Nigeria','1.2','masculinity_femininity','MF1','Being recognized as the best performer is a primary motivator for me.','direct'),
('Nigeria','1.2','masculinity_femininity','MF2','I prefer a collaborative work environment over a highly competitive one.','inverse'),
('Nigeria','1.2','masculinity_femininity','MF3','Work-life balance and a friendly atmosphere are more important than a high salary and bonus.','inverse'),
('Nigeria','1.2','masculinity_femininity','MF4','Conflicts at work are best resolved by open competition to find the best idea.','direct'),

-- Dimension 4: Attitude to Rules & Risk (Uncertainty Avoidance) - Nigeria UAI: 55
('Nigeria','1.2','uncertainty_avoidance','UA1','It is important to have clear rules and procedures for every situation.','direct'),
('Nigeria','1.2','uncertainty_avoidance','UA2','I feel comfortable starting a project even if the requirements are not perfectly clear.','inverse'),
('Nigeria','1.2','uncertainty_avoidance','UA3','Company rules should not be broken, even if it''s for the good of the company.','direct'),
('Nigeria','1.2','uncertainty_avoidance','UA4','Job security is more important to me than taking on a risky but innovative new role.','direct'),

-- Dimension 5: Time Perception & Tradition (Long-Term Orientation) - Nigeria LTO: 13 (short-term)
('Nigeria','1.2','long_term_orientation','LTO1','Achieving quick, short-term results is my main priority on a project.','direct'),
('Nigeria','1.2','long_term_orientation','LTO2','We should stick to established traditions and ways of working rather than trying new things.','direct'),
('Nigeria','1.2','long_term_orientation','LTO3','I am willing to invest time in a project that will only pay off in the distant future.','inverse'),

-- Dimension 6: Work-Life Integration (Indulgence-Restraint) - Nigeria IND: 84 (indulgent)
('Nigeria','1.2','indulgence_restraint','IR1','It''s important to celebrate successes and have fun with colleagues at work.','direct'),
('Nigeria','1.2','indulgence_restraint','IR2','Work should be taken very seriously, with a clear separation from personal enjoyment.','inverse'),
('Nigeria','1.2','indulgence_restraint','IR3','Spending money on leisure and personal enjoyment is important to me.','direct'),

-- Dimension 7: Communication Style (high-context/indirect vs low-context/direct)
('Nigeria','1.2','communication_style','CS1','When giving feedback, it is more important to be polite and avoid causing offense than to be completely direct.','direct'),
('Nigeria','1.2','communication_style','CS2','I prefer communication to be precise, simple, and explicit.','inverse'),
('Nigeria','1.2','communication_style','CS3','Reading ''between the lines'' is often necessary to understand what a colleague truly means.','direct');

-- Country cultural data (for report context)
CREATE TABLE IF NOT EXISTS country_profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) UNIQUE NOT NULL,
  iso_code    CHAR(2) NOT NULL,
  summary     TEXT,
  key_insights JSONB DEFAULT '[]',
  hofstede_scores JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO country_profiles (name, iso_code, summary, key_insights, hofstede_scores) VALUES

('Nigeria', 'NG',
 'Nigeria is a highly hierarchical (PD=80) and collectivist (IDV=30) society. With a Masculinity score of 60, it is achievement-driven. The very low LTO (13) indicates short-term focus and respect for tradition. The very high Indulgence score (84) means celebrating success is culturally important.',
 '["High Power Distance: Managers are expected to be decisive ''benevolent autocrats''", "Strong Collectivism: Group loyalty and harmony are paramount over individual recognition", "Relationship-driven: Personal trust is a prerequisite for business - inquire about family and well-being", "Achievement-oriented: Competition and success are valued", "Short-term focus: Quick results matter; traditions are respected", "Highly indulgent: Celebrating success and socializing at work is encouraged", "Indirect communication: Face-saving is important; confrontation avoided"]',
 '{"power_distance": 80, "individualism": 30, "masculinity": 60, "uncertainty_avoidance": 55, "long_term_orientation": 13, "indulgence": 84}'
),

('South Africa', 'ZA',
 'A diverse ''rainbow nation'' with a complex mix of influences. Individualistic (IDV=65) with moderate hierarchy (PD=49). While direct communication is common, there is a growing trend toward consultative decision-making (''indaba'') rooted in Ubuntu philosophy. Feedback often delivered privately to ''save face''.',
 '["Moderate hierarchy: More consultative than Nigeria - Ubuntu philosophy encourages shared decision-making", "Individualistic but with Ubuntu: Balance personal achievement with community harmony", "Direct but tactful: Relatively direct communication, but face-saving still matters", "''Indaba'' style: Seek input before making final decisions", "Ubuntu spirit: ''I am because we are'' - show concern for colleagues as people"]',
 '{"power_distance": 49, "individualism": 65, "masculinity": 63, "uncertainty_avoidance": 49, "long_term_orientation": 34, "indulgence": 63}'
),

('Kenya', 'KE',
 'A relationship-driven, collectivist, and hierarchical business culture. The concept of ''Harambee'' (pulling together) reflects strong community spirit. Communication is often indirect and polite to maintain harmony. Achievement-oriented (MAS=60).',
 '["Harambee spirit: ''Pulling together'' - emphasize collective achievement", "Relationship first: Build rapport before discussing business", "Hierarchical: High Power Distance (PD=70) - respect seniority", "Indirect communication: Politeness preserves harmony", "Short-term focus: Quick wins matter (LTO=25)"]',
 '{"power_distance": 70, "individualism": 25, "masculinity": 60, "uncertainty_avoidance": 50, "long_term_orientation": 25}'
),

('Ghana', 'GH',
 'A highly hierarchical (PD=80) and very collectivist (IDV=15) culture where group harmony is paramount. Decision-making is top-down. Very low LTO (4) fosters a focus on short-term results and respect for tradition, with a more fluid perception of deadlines. High Indulgence (72) creates a positive, celebratory social work environment.',
 '["Highly hierarchical: Top-down decisions, junior members deferential to superiors", "Very collectivist: Group harmony paramount; individual credit can cause discomfort", "Short-term focus: Very low LTO (4) - deadlines can be fluid; prioritize relationships", "Indirect communication: Face-saving critical; criticize privately never publicly", "Celebratory: High indulgence (72) - celebrate successes together as a team", "Meeting etiquette: Senior member leads, juniors listen respectfully"]',
 '{"power_distance": 80, "individualism": 15, "masculinity": 40, "uncertainty_avoidance": 65, "long_term_orientation": 4, "indulgence": 72}'
),

('Egypt', 'EG',
 'A strongly hierarchical and relationship-based culture with very high Uncertainty Avoidance (UAI=80), meaning a need for rigid rules and intolerance for unorthodox ideas. Highly ''Restrained'' society (IND=4). The concept of ''face'' is critical, and direct confrontation is avoided.',
 '["Very high hierarchy: PD=70, authority must be respected", "Need for clear rules: UAI=80 - provide detailed procedures, avoid ambiguity", "Face concept: Critical - never embarrass someone publicly", "Restrained culture: IND=4 - formal, conservative work environment", "Relationship-based: Trust built slowly through personal connections", "Collectivist: Group decisions, avoid individual blame"]',
 '{"power_distance": 70, "individualism": 25, "masculinity": 45, "uncertainty_avoidance": 80, "long_term_orientation": 7, "indulgence": 4}'
),

('Ethiopia', 'ET',
 'A formal, hierarchical, and collectivist culture where age and seniority command great respect. Achievement-oriented (MAS=65). Communication is highly indirect, and patience is essential. Building personal relationships is a prerequisite for business.',
 '["Respect for seniority: Age and title command deep respect", "Formal culture: Meetings are formal, address by title", "Highly indirect: Communication is subtle; read between the lines", "Patience required: Relationship-building takes time before business", "Collectivist: Group decisions, collective responsibility", "Achievement focus: MAS=65 - results and success matter"]',
 '{"power_distance": 70, "individualism": 20, "masculinity": 65, "uncertainty_avoidance": 55, "long_term_orientation": 25, "indulgence": 46}'
);
