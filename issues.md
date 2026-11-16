- Ordering below the minimum amount (60 rs for polar), causes an internal server error instead of a 400 response. => ordering 1 59rs item is an internal server error but ordering 2 of them succeeds. (fixed, but local dev env still gets the internal server error due to timeout from polar, likely a dns/local network issue)

- orders on the orders page show the amount in usd even though the payments were made in inr. (fixed)

- change the default tab icon for the website (fixed)
- add screenshots to the readme 