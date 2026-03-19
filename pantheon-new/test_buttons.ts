import { suggestButtons } from './server/utils/buttons';

const msg = "Good morning! Here is the briefing: You have an overdue assignment, you need to go to Apollo for your shift, and remember to prepare for your exam.";
console.log(suggestButtons(msg, 'NYX'));
