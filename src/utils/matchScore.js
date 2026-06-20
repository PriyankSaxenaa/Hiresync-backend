// compares a candidate's skills against a job's required skills
// returns a match percentage plus which skills matched / are missing

function matchScore(candidateSkills, jobSkills) {
    if (!jobSkills || jobSkills.length === 0) {
        return { score: 0, matchedSkills: [], missingSkills: [] };
    }

    // lowercase everything so "React" and "react" both count as a match
    const candidateSet = new Set((candidateSkills || []).map(s => s.toLowerCase()));
    const jobSet = jobSkills.map(s => s.toLowerCase());

    const matchedSkills = jobSet.filter(skill => candidateSet.has(skill));
    const missingSkills = jobSet.filter(skill => !candidateSet.has(skill));

    const score = Math.round((matchedSkills.length / jobSet.length) * 100);

    return { score, matchedSkills, missingSkills };
}

module.exports = { matchScore };
