# curr issues

2/8/26 - lichess embed iframes being funky with strict browser settings so to have moves actually work within the embed i'll probably need to use chessboard.js

2/9/26 -
chessboard.js/chess.min.js/jquery.min.js integration successful

average time is broken (although i still don't know why)

just needed to convert UCI notation from lichess API to PGN :D

thanks to the wonderful people below for making such an easy-to-use standalone board!

https://github.com/serbanghita/jQuery-Chess

https://github.com/oakmac/chessboardjs

# next steps:

make sure stats persist/no weird behavior in puzzles (3/25/26 -- promotions seem to be bugged & need to clean up UI)

3/25/26 -- picking up a piece right as response finishes causes piece to keep following cursor indefinitely (fix cleanUp method)

have cool videos to watch in the embed since right now it's just rick roll and me at the zoo
