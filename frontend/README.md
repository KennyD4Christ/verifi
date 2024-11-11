Package Manager Exception
This project primarily uses npm as the package manager. Dependencies are managed and locked in package-lock.json. However, due to compatibility issues, the following packages require Yarn for installation:

react-responsive
lucide-react
If you encounter installation issues with these packages, please install them using Yarn:

# Install specific packages with Yarn
yarn add react-responsive lucide-react
After installing with Yarn, you can return to npm for other dependency management tasks.

Note: Please do not remove the yarn.lock file from the project, as it is necessary for managing these dependencies.
