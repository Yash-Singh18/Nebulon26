its time we implement our second page - "Team tracking" - can be visited thro navbar or the card on homepage,

this is really really similar to the our "Track Expense" page but with TEAM,

but here not only one guy but entire team works together for tracking money, how it works is - anyone can create there business - a new room with new id will be created - with the creater being the admin

now any user can join the room by entering the room id, and now this user is a member of this room, now this user can also add transactions, but the transaction will have a uuid attached with it stating that this transaction was added by this user

but on left side bar we will be having "Admin Panel" which can be visited just by the admin, rest all user can just "Request Admin"
admin needs to approve transaction before its added
on left panel will also have "Manage Team" where users can view all the teammates - with admin having a badge attached, admin can kick anyone from the room too

now the core feature of room "Chat" - its a real time websocket based chat where room members can chat together and tag eachother using username.

NOTE : even tho ai-service in this is same just a slight difference that is ai now have to deal with users so it needs to also mine the user data while answering so create more tools for user based chat.means you need to pass similar data with more dimention into the ai

each member while joining should add a tag to themself - like department such as "Design" , "Sales" , etc etc...

this tag is visible to all user via chat, admin panel, manage team....



