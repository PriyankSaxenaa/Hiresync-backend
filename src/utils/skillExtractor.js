// matching against a fixed list so we dont accidentally extract
// garbage like "Java" from "JavaScript" or pick up random words

const SKILLS_LIST = [
    // languages
    'javascript', 'typescript', 'python', 'java', 'c', 'c++', 'c#', 'go', 'rust',
    'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'dart', 'perl', 'haskell',
    'elixir', 'clojure', 'lua', 'matlab', 'bash', 'shell',

    // frontend
    'react', 'vue', 'angular', 'next.js', 'nuxt.js', 'svelte', 'html', 'css',
    'sass', 'scss', 'tailwind', 'bootstrap', 'jquery', 'webpack', 'vite',
    'redux', 'zustand', 'graphql',

    // backend
    'node.js', 'express', 'django', 'flask', 'fastapi', 'spring', 'spring boot',
    'laravel', 'rails', 'asp.net', 'nest.js', 'hapi', 'koa', 'fiber',

    // databases
    'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis', 'elasticsearch',
    'cassandra', 'dynamodb', 'firebase', 'supabase', 'oracle', 'sql server',
    'mongoose', 'prisma', 'sequelize', 'typeorm',

    // cloud & devops
    'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ansible',
    'jenkins', 'github actions', 'circleci', 'nginx', 'apache', 'linux',
    'ci/cd', 'helm',

    // tools & others
    'git', 'github', 'gitlab', 'bitbucket', 'jira', 'figma', 'postman',
    'swagger', 'rest api', 'graphql', 'websocket', 'socket.io', 'grpc',
    'microservices', 'kafka', 'rabbitmq', 'celery',

    // mobile
    'react native', 'flutter', 'android', 'ios', 'expo',

    // ml / data
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras',
    'scikit-learn', 'pandas', 'numpy', 'opencv', 'nlp', 'computer vision',
    'data analysis', 'tableau', 'power bi',

    // testing
    'jest', 'mocha', 'chai', 'cypress', 'selenium', 'pytest', 'junit',
];

function extractSkills(text) {
    const lowerText = text.toLowerCase();
    const found = [];

    for (const skill of SKILLS_LIST) {
        // use word boundary regex so "java" doesnt match inside "javascript"
        const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i');
        if (regex.test(lowerText) && !found.includes(skill)) {
            found.push(skill);
        }
    }

    return found;
}

module.exports = { extractSkills };
