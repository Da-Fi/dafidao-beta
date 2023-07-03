let pkgs = import <nixpkgs> {};

in pkgs.mkShell rec {
  name = "webdev";
  
  buildInputs = with pkgs; [
    nodejs-16_x
    nodePackages.typescript-language-server 
    (yarn.override { nodejs = nodejs-16_x; })
  ];
}