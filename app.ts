import { Bot, Context, session, SessionFlavor } from "grammy";
import { Menu, MenuRange } from "@grammyjs/menu";

// Import functions to get SOL balance and parse Raydium swap transactions
import { getSOLBalanceAndUSD, getRaydiumSwapParseData } from "./src/api";
import { BOT_TOKEN } from "./src/constants";

// Utility function to validate transaction signatures
import { validateTransactionSignature } from "./src/utils";

/** Defines an action type for bot commands, with unique id and name */
interface Action {
  readonly id: string;
  readonly name: string;
}

/** Defines session data structure to store the current action ID */
interface SessionData {
  actionID: string;
}
type MyContext = Context & SessionFlavor<SessionData>;

/**
 * Array of all actions available for the bot. 
 * Each action has an ID and name to display in the menu.
 */
const actions: Action[] = [
  { id: "parseTX", name: "Parse Swap Tx" },
  { id: "getBalance", name: "Get Wallet Balance" },
];

// Initialize the bot with the provided token and session data type
const bot = new Bot<MyContext>(BOT_TOKEN);

// Middleware to manage sessions and initialize session data
bot.use(
  session({
    initial(): SessionData {
      return { actionID: "" }; // default action ID is empty
    },
  })
);

// Create main menu for selecting actions, with each action as a button
const mainText = "What do you want to do?";
const mainMenu = new Menu<MyContext>("action");
mainMenu.dynamic(() => {
  const range = new MenuRange<MyContext>();
  for (const action of actions) {
    // Each button in the menu navigates to a "next" submenu
    range.submenu(
      { text: action.name, payload: action.id }, // button label and payload
      "next", // submenu identifier
      (ctx) => {
        // Sets session action ID and shows prompt message for chosen action
        ctx.session.actionID = action.id;
        ctx.editMessageText(handleActionPrompt(action.id), {
          parse_mode: "HTML",
        });
      }
    );
  }
  return range; // returns the configured menu range
});

// Function to generate action-specific prompts
function handleActionPrompt(actionId: string): string {
  const prompts: Record<string, string> = {
    parseTX: "Please input the transaction signature.",
    getBalance: "Please input the wallet address.",
  };

  const message = prompts[actionId];
  return message; // returns prompt based on action ID
}

// Define the submenu for navigating back after selecting an action
const nextMenu = new Menu<MyContext>("next");

nextMenu.dynamic((ctx) => {
  const next = ctx.match;
  if (typeof next !== "string") throw new Error("No action chosen!");
  return createNextMenu(next); // generates the back navigation menu
});

// Helper function to create "Back" button for returning to the main menu
function createNextMenu(next: string) {
  return new MenuRange<MyContext>().back({ text: "Back", payload: next });
}

// Register submenus in main menu
mainMenu.register(nextMenu);

// Apply the main menu as middleware in the bot
bot.use(mainMenu);

// Define the /start command to show main menu
bot.command("start", (ctx) => ctx.reply(mainText, { reply_markup: mainMenu }));

// Define the /help command to explain bot usage
bot.command("help", async (ctx) => {
  const text = "Send /start to see and select actions.";
  await ctx.reply(text);
});

// Set bot commands for easy access to start and help
bot.api.setMyCommands([
  { command: "start", description: "start to chat with bot" },
  { command: "help", description: "help for you to use this more correctly" },
]);

// Handle incoming messages based on the selected action in session
bot.on("message", async (ctx) => {
  if (ctx.session.actionID == "parseTX") {
    // Action for parsing a transaction signature
    const signature = ctx.message.text as string;
    if (!validateTransactionSignature(signature)) {
      // Reply if the transaction signature is invalid
      ctx.reply("Invalid transaction signature");
    } else {
      try {
        // Parse and respond with Raydium swap transaction details
        const parsedJson = await getRaydiumSwapParseData(signature);
        ctx.reply(JSON.stringify(parsedJson));
      } catch (e) {
        console.error(e); // Log any parsing errors
        ctx.reply(JSON.stringify(e));
      }
    }
  } else if (ctx.session.actionID == "getBalance") {
    // Action for fetching wallet SOL balance
    const walletBalance = await getSOLBalanceAndUSD(ctx.message.text as string);
    ctx.reply(walletBalance); // Reply with wallet balance
  }
});

// Catch and log any errors in bot operation
bot.catch(console.error.bind(console));

// Start the bot
bot.start();