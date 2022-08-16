var ghpages = require("gh-pages");
var fs = require("fs");

fs.openSync("out/.nojekyll", "w");
fs.copyFileSync("CNAME", "out/CNAME");

ghpages.publish("out", { dotfiles: true });