now we create our first and most important feature , track expense page - exceesed via navbar "Track Expense" and card on home page "Track Expense", 


1. User can create and manage multiple businesses - each having its own data like different rooms 
2. Each business is its own entity having a left navigation bar like in references/leftnav.png having option : 

2.1 About - add bussiness name and type and more detail with about paragraph tooo
2.2 Dashboard (MVP) - user can :
    User can add:

    amount
    type (income or expense)
    category (optional)
    timestamp (default: current time)

    not only manaul entry but user can directly upload a csv file into it having structure amount,type,category,timestamp

    this dashboard have multiple graphs with the simpliest line graph being default, and in this profit and expense are shown in different colors, while giving user an option to select one by a simple checkboxes and also a compare button to split it into two graphs, user also have a dropbox + checkbox option to select only the category they want

    all feature should be working for each graph and a option to compare btw each type, category at anypoint 
    each graphs time can be set as (last 24 hours, last 7 days, last 30 days, last 6 months, last 1 year, custom range)
    also graph must flag a anomility (toogle option for usr to switch it on or off).

User can:

Select multiple graph types
View them together in a grid

Examples:

category A v/s category B
Income vs Expense (separate graphs)
Line + Bar together
Category pie + trend line

usr can also download this csv file 

2.3 Ai-Bot :  
using llama 70b via groq it will have about and all dashboard content (as csv) as context, we always pass business_id for it to access this data and just answer using it 
Capabilities:

Summarize performance
Answer questions
Detect trends
Give simple recommendations

Prebuilt Actions:
"Summarize my business"
"Show risks"
"Give suggestions"

NOTE: this ai bot is not gonna go ahead and work on data all by itself - it is smart and have access to tools(create this tools too) i.e 
    1.get_financial_summary
    2.get_category_breakdown
    3.get_time_trends
    4.detect_anomalies


llm just decides to call the tool and use data returned by tool to answer - if query is complex and can not be fullfilled via tools then only llm should go ahead and calculate itself

Tools = truth
LLM = storyteller

example:
Ask:

“Where am I overspending?”

Your AI:

calls category tool
responds clearly


🚫 WHAT NOT TO DO

❌ Send full raw DB
❌ Let LLM calculate everything
❌ No structure in prompt
❌ Generic ChatGPT answers

Add prebuilt buttons:

Summarize business
Show biggest expenses
Predict future trend

Frontend → API → Fetch data (business_id)
                ↓
         Aggregate + preprocess
                ↓
         Smart routing (optional)
                ↓
         LLM (Groq LLaMA 70B)
                ↓
         Structured response
                ↓
             UI

you can use llama 8b for smart routing if you want (use it if you think it can improve our system)



you can create .env files and tell me locations, i will add requried api keys and info in there,
also build the ai system as a microservice soo i can be deployed easily with entire project using docker compose
