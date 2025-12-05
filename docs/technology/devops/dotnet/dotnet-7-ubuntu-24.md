---
sidebar_position: 2
---

# .NET 7.0 on Ubuntu 24.x

Ubuntu 24.x does not include .NET 7 in default repos. Use the dotnet/backports PPA.

```bash
sudo add-apt-repository ppa:dotnet/backports
sudo apt update
sudo apt install dotnet-runtime-7.0
```

If you need the SDK instead of just the runtime:

```bash
sudo apt install dotnet-sdk-7.0
```

Verify installation:

```bash
dotnet --info
```
