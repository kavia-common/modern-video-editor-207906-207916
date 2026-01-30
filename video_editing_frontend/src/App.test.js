import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders timeline section", () => {
  render(<App />);
  const el = screen.getByText(/timeline/i);
  expect(el).toBeInTheDocument();
});
