## Additional Tasks

- Customized Player Numbers: Allow the Host to specify the number of Players upon deployment.

Can pass the number of players to the constructor, when deploy contract. And update the logic for `winningGame` to check the winner of the game.

- Explain the reason of having both nonceHash and nonceNumHash in the smart contract. Can any of these two be omitted and why?

1. Encrypted the result for the game. When the host deploy contract, and he can reveal the result, as only he can know the result.
2. Cannot omit any of nonceHash and nonceNumHash. As the number of range is `[0, 1000)`, can guess the result in the fixed value.

- Try to find out any security loopholes in the above design and propose an improved solution.

1. Anyone can call the `reveal` function.
2. The Host earn nothing about the game.
