## Additional Tasks

- Customized Player Numbers: Allow the Host to specify the number of Players upon deployment.

Can pass the number of players as an argument to the constructor, and save it in the storage, when deploy contract. And update the logic for `winningGame` to check the winner of the game.

- Explain the reason of having both nonceHash and nonceNumHash in the smart contract. Can any of these two be omitted and why?

1. Encrypted the `result` for the game. When the host deploys contract with the `nonceHash` and `nonceNumHash`, on one can know the result from the `hash`, and the host can reveal the result, as only he can know the result.
2. Cannot omit any of nonceHash and nonceNumHash. As the number of range is `[0, 1000)` a fixed value, someone maybe can guess the result from the encrypted result.

- Try to find out any security loopholes in the above design and propose an improved solution.

1. Anyone can call the `reveal` function.
2. The Host earn nothing about the game.
